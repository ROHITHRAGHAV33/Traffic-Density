import streamlit as st
import os
import time
import pandas as pd

from model_loader import load_model
from video_processor import process_video

# ── Page Config ─────────────────────────────
st.set_page_config(
    page_title="Traffic Density System",
    layout="wide",
    page_icon="🚦"
)

# ── Custom Styling ──────────────────────────
st.markdown("""
<style>
.title {
    text-align: center;
    font-size: 38px;
    font-weight: bold;
    color: #1f2937;
}
.section {
    text-align: center;
    font-size: 22px;
    margin-top: 10px;
    margin-bottom: 10px;
}
.card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0px 4px 12px rgba(0,0,0,0.1);
}
.metric {
    font-size: 30px;
    font-weight: bold;
}
.stButton>button {
    width: 100%;
    height: 45px;
    font-size: 16px;
    background-color: #2563eb;
    color: white;
    border-radius: 10px;
}
</style>
""", unsafe_allow_html=True)

# ── Title ──────────────────────────────────
st.markdown('<div class="title">🚦 Traffic Density Prediction System</div>', unsafe_allow_html=True)
st.markdown("---")

# ── Load Model ─────────────────────────────
@st.cache_resource
def get_model():
    return load_model("model.pt")

model = get_model()

# ── Upload Section ─────────────────────────
st.markdown('<div class="section">📤 Upload Traffic Video</div>', unsafe_allow_html=True)

uploaded_file = st.file_uploader("", type=["mp4"])

if uploaded_file is not None:

    input_path = "input.mp4"
    with open(input_path, "wb") as f:
        f.write(uploaded_file.read())

    # ── SIDE BY SIDE LAYOUT (FIXED) ─────────
    col1, col2 = st.columns(2, gap="large")

    with col1:
        st.markdown('<div class="section">🎥 Original Video</div>', unsafe_allow_html=True)
        st.video(input_path)

    # ── PROCESS BUTTON ──────────────────────
    if st.button("🚀 Start Analysis"):

        # Placeholders for live graph
        graph_placeholder = st.empty()

        def update_ui(vehicle_counts, frame):
            df = pd.DataFrame({
                "Frame": list(range(len(vehicle_counts))),
                "Vehicles": vehicle_counts
            })
            graph_placeholder.line_chart(df.set_index("Frame"))

        # ── PROCESS VIDEO ───────────────────
        with st.spinner("Analyzing traffic... ⏳"):
            output_path = "output.mp4"

            density, total, vehicle_counts = process_video(
                model,
                input_path,
                output_path,
                update_callback=update_ui
            )

        st.success("✅ Analysis Complete!")
        time.sleep(1)

        # ── SHOW PROCESSED VIDEO (RIGHT SIDE) ─
        with col2:
            st.markdown('<div class="section">🎬 Processed Video</div>', unsafe_allow_html=True)

            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                with open(output_path, "rb") as f:
                    st.video(f.read())
            else:
                st.error("❌ Output video not found")

        # ── RESULTS ──────────────────────────
        st.markdown("---")
        st.markdown('<div class="section">📊 Traffic Analysis Results</div>', unsafe_allow_html=True)

        c1, c2 = st.columns(2)

        with c1:
            st.markdown(f"""
            <div class="card">
                <h3>🚗 Total Vehicles</h3>
                <div class="metric">{total}</div>
            </div>
            """, unsafe_allow_html=True)

        color_map = {
            "LOW": "#16a34a",
            "MEDIUM": "#f59e0b",
            "HIGH": "#ef4444",
            "CRITICAL": "#7f1d1d"
        }

        with c2:
            st.markdown(f"""
            <div class="card">
                <h3>📊 Traffic Density</h3>
                <div class="metric" style="color:{color_map.get(density, 'black')}">
                    {density}
                </div>
            </div>
            """, unsafe_allow_html=True)

        # ── FINAL GRAPH ──────────────────────
        st.markdown("---")
        st.markdown('<div class="section">📈 Traffic Trend Analysis</div>', unsafe_allow_html=True)

        df = pd.DataFrame({
            "Frame": list(range(len(vehicle_counts))),
            "Vehicles": vehicle_counts
        })

        st.line_chart(df.set_index("Frame"))

        # Extra stats
        avg = sum(vehicle_counts) / len(vehicle_counts)
        peak = max(vehicle_counts)

        st.markdown(f"""
        <div class="card">
            <p><b>📊 Average Vehicles:</b> {avg:.2f}</p>
            <p><b>🚨 Peak Traffic:</b> {peak} vehicles</p>
        </div>
        """, unsafe_allow_html=True)

        # Footer
        st.markdown("---")
        st.markdown(
            "<center><small>Smart Traffic Analysis • YOLOv8 • Streamlit</small></center>",
            unsafe_allow_html=True
        )
