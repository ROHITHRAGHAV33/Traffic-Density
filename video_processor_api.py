import cv2
import os
from density import classify_density

def process_video_api(model, input_path, output_path, update_callback=None):
    """
    Processes the input video using YOLO model tracking, writes the annotated video
    to output_path, and calls update_callback(current_frame, total_frames, active_count, unique_ids_count, density)
    on every frame.
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise Exception(f"Could not open input video: {input_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps    = cap.get(cv2.CAP_PROP_FPS) or 25

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Use mp4v or avc1 for H.264 compression which is browser-playable.
    # Note: cv2.VideoWriter_fourcc(*"mp4v") works broadly, but for browser playback
    # we sometimes need "avc1" (H.264) or convert it using ffmpeg if installed.
    # We will try "mp4v" or "avc1" and see what works best.
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(
        output_path,
        fourcc,
        fps,
        (width, height)
    )

    unique_ids = set()
    vehicle_counts = []
    current_frame = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            current_frame += 1

            # Run YOLO tracking
            results = model.track(frame, persist=True, conf=0.3, verbose=False)
            boxes = results[0].boxes

            if boxes is not None and boxes.id is not None:
                ids = boxes.id.int().cpu().tolist()
                for i in ids:
                    unique_ids.add(i)
                active_count = len(ids)
            else:
                active_count = 0

            vehicle_counts.append(active_count)
            density = classify_density(active_count)
            total_unique = len(unique_ids)

            # Draw annotations on the frame
            annotated = results[0].plot()

            # Add overlay text
            cv2.putText(annotated, f"Vehicles: {active_count}", (20, 45),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
            cv2.putText(annotated, f"Density: {density}", (20, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)
            cv2.putText(annotated, f"Total Unique: {total_unique}", (20, 135),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 2)

            out.write(annotated)

            # Fire progress update callback
            if update_callback:
                update_callback(current_frame, total_frames, active_count, total_unique, density)

    finally:
        cap.release()
        out.release()

    final_density = classify_density(sum(vehicle_counts) // len(vehicle_counts) if vehicle_counts else 0)
    return final_density, len(unique_ids), vehicle_counts
