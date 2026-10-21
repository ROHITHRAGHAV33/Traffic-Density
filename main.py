import cv2
from ultralytics import YOLO

# ── Load YOUR trained model ───────────────────────────────────
model = YOLO("model.pt")

# ── Density function ──────────────────────────────────────────
def classify_density(count):
    if count <= 10:    return "LOW"
    elif count <= 20: return "MEDIUM"
    elif count <= 30: return "HIGH"
    else:             return "CRITICAL"

# ── Open video ────────────────────────────────────────────────
cap    = cv2.VideoCapture("traffic2.mp4")
width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps    = cap.get(cv2.CAP_PROP_FPS) or 25

# ── Output video ──────────────────────────────────────────────
out = cv2.VideoWriter(
    "output.mp4",
    cv2.VideoWriter_fourcc(*"mp4v"),
    fps, (width, height)
)

frame_count = 0
unique_ids  = set()

print("🚀 Running detection...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # ── YOUR model detects vehicles ───────────────────────────
    results = model.track(
        frame,
        persist = True,
        conf    = 0.1,
        verbose = False
    )

    # ── Count vehicles ────────────────────────────────────────
    boxes = results[0].boxes
    if boxes is not None and boxes.id is not None:
        track_ids = boxes.id.int().cpu().tolist()
        for tid in track_ids:
            unique_ids.add(tid)
        active_count = len(track_ids)
    else:
        active_count = 0

    total_unique = len(unique_ids)
    density      = classify_density(active_count)

    # ── Draw on frame ─────────────────────────────────────────
    annotated = results[0].plot()

    cv2.putText(annotated,
                f"Vehicles : {active_count}",
                (20, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2, (0, 255, 0), 3)

    cv2.putText(annotated,
                f"Density  : {density}",
                (20, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2, (0, 255, 255), 3)

    cv2.putText(annotated,
                f"Total Unique : {total_unique}",
                (20, 135),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0, (255, 255, 0), 2)

    # ── Show live window ──────────────────────────────────────
    cv2.imshow("Traffic Density Detection", annotated)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

    out.write(annotated)
    frame_count += 1

    if frame_count % 30 == 0:
        print(f"Frame {frame_count} | "
              f"Vehicles: {active_count} | "
              f"Density: {density}")

cap.release()
out.release()
cv2.destroyAllWindows()

print(f"\n✅ Done!")
print(f"Total frames    : {frame_count}")
print(f"Unique vehicles : {total_unique}")
print(f"Output saved    : output.mp4")