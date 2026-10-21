from ultralytics import YOLO

def load_model(path="model.pt"):
    return YOLO(path)
