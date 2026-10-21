def classify_density(count):
    if count <= 8:
        return "LOW"
    elif count <= 20:
        return "MEDIUM"
    elif count <= 40:
        return "HIGH"
    else:
        return "CRITICAL"
