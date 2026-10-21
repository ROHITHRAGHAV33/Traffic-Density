import cv2
from density import classify_density

def process_video(model, input_path, output_path, update_callback=None):

    cap = cv2.VideoCapture(input_path)

    width  = int(cap.get(3))
    height = int(cap.get(4))
    fps    = cap.get(cv2.CAP_PROP_FPS) or 25

    out = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"avc1"),
        fps,
        (width, height)
    )

    unique_ids = set()
    vehicle_counts = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        results = model.track(frame, persist=True, conf=0.3)

        boxes = results[0].boxes

        if boxes is not None and boxes.id is not None:
            ids = boxes.id.int().cpu().tolist()
            for i in ids:
                unique_ids.add(i)
            count = len(ids)
        else:
            count = 0

        vehicle_counts.append(count)

        density = classify_density(count)

        annotated = results[0].plot()

        cv2.putText(annotated, f"Vehicles: {count}", (20,40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

        cv2.putText(annotated, f"Density: {density}", (20,80),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,255), 2)

        out.write(annotated)

        # 🔥 Live update
        if update_callback:
            update_callback(vehicle_counts, annotated)

    cap.release()
    out.release()

    return density, len(unique_ids), vehicle_counts
