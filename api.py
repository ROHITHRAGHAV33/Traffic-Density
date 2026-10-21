import os
import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from video_processor_api import process_video_api
from model_loader import load_model

app = FastAPI(title="Traffic Density Detector API")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for video processing tasks
tasks = {}

# Ensure static directories exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
OUTPUT_DIR = os.path.join(STATIC_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Lazy loading YOLO model
model = None

def get_model():
    global model
    if model is None:
        # Load from local best.pt or model.pt. Defaulting to model.pt as in app.py
        model_path = "model.pt" if os.path.exists("model.pt") else "best.pt"
        if not os.path.exists(model_path):
            # Fallback to yolov8n.pt if others don't exist
            model_path = "yolov8n.pt"
        model = load_model(model_path)
    return model

def background_video_processing(task_id: str, input_path: str, output_path: str):
    try:
        yolo_model = get_model()

        def progress_callback(current_frame, total_frames, active_count, total_unique, density):
            tasks[task_id]["current_frame"] = current_frame
            tasks[task_id]["total_frames"] = total_frames
            tasks[task_id]["active_count"] = active_count
            tasks[task_id]["unique_ids_count"] = total_unique
            tasks[task_id]["density"] = density
            tasks[task_id]["vehicle_counts"].append(active_count)
            tasks[task_id]["progress"] = int((current_frame / total_frames) * 100) if total_frames > 0 else 0

        final_density, unique_count, vehicle_counts = process_video_api(
            yolo_model,
            input_path,
            output_path,
            update_callback=progress_callback
        )

        avg_vehicles = sum(vehicle_counts) / len(vehicle_counts) if vehicle_counts else 0
        peak_vehicles = max(vehicle_counts) if vehicle_counts else 0

        tasks[task_id].update({
            "status": "completed",
            "progress": 100,
            "density": final_density,
            "unique_ids_count": unique_count,
            "average_vehicles": round(avg_vehicles, 2),
            "peak_vehicles": peak_vehicles,
            "output_url": f"/static/outputs/{task_id}_output.mp4"
        })

    except Exception as e:
        tasks[task_id].update({
            "status": "failed",
            "error": str(e)
        })

@app.post("/api/process")
async def start_processing(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Verify file extension
    if not file.filename.lower().endswith(".mp4"):
        raise HTTPException(status_code=400, detail="Only MP4 videos are supported.")

    task_id = uuid.uuid4().hex
    input_path = os.path.join(UPLOAD_DIR, f"{task_id}_input.mp4")
    output_path = os.path.join(OUTPUT_DIR, f"{task_id}_output.mp4")

    # Save uploaded file
    with open(input_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Initialize task metadata
    tasks[task_id] = {
        "status": "processing",
        "progress": 0,
        "current_frame": 0,
        "total_frames": 0,
        "active_count": 0,
        "unique_ids_count": 0,
        "density": "LOW",
        "vehicle_counts": [],
        "average_vehicles": 0,
        "peak_vehicles": 0,
        "output_url": None,
        "error": None
    }

    # Queue background task
    background_tasks.add_task(
        background_video_processing,
        task_id,
        input_path,
        output_path
    )

    return {"task_id": task_id}

@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.get("/api/sample-videos")
async def get_sample_videos():
    # List traffic*.mp4 in the workspace
    videos = []
    for f in os.listdir("."):
        if f.startswith("traffic") and f.endswith(".mp4"):
            videos.append(f)
    return {"videos": sorted(videos)}

@app.get("/videos/{filename}")
async def get_video(filename: str):
    from fastapi.responses import FileResponse
    if filename.startswith("traffic") and filename.endswith(".mp4") and os.path.exists(filename):
        return FileResponse(filename)
    raise HTTPException(status_code=404, detail="Video not found")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "model_loaded": model is not None}

# Mount the static directory to serve index.html, JS, and CSS
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    # Automatically triggers uvicorn server on port 8000 when running directly
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
