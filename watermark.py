# watermark.py
import sys
import cv2
import os

"""
Usage:
python watermark.py input_path output_path "Watermark text" position

position: one of "top-left", "top-right", "bottom-left", "bottom-right", "center"
"""

def get_position(pos_name, frame_width, frame_height, text_size):
    text_w, text_h = text_size
    margin = 20

    if pos_name == "top-left":
        return (margin, margin + text_h)
    if pos_name == "top-right":
        return (frame_width - text_w - margin, margin + text_h)
    if pos_name == "bottom-left":
        return (margin, frame_height - margin)
    if pos_name == "bottom-right":
        return (frame_width - text_w - margin, frame_height - margin)
    if pos_name == "center":
        return ((frame_width - text_w) // 2, (frame_height + text_h) // 2)

    # default
    return (frame_width - text_w - margin, frame_height - margin)


def main():
    if len(sys.argv) < 5:
        print("Usage: watermark.py input_path output_path 'Watermark text' position", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    watermark_text = sys.argv[3]
    position = sys.argv[4]

    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print("Failed to open input video", file=sys.stderr)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Choose codec – adjust to something your environment supports
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.0
    thickness = 2

    # Measure text once
    (text_w, text_h), _ = cv2.getTextSize(watermark_text, font, font_scale, thickness)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Make an overlay to do translucent background
        overlay = frame.copy()

        x, y = get_position(position, width, height, (text_w, text_h))

        # Background rectangle (semi-transparent)
        pad = 10
        x1 = max(x - pad, 0)
        y1 = max(y - text_h - pad, 0)
        x2 = min(x + text_w + pad, width)
        y2 = min(y + pad, height)

        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 0), -1)  # black box

        alpha = 0.4  # transparency
        frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

        # Text (white)
        cv2.putText(
            frame,
            watermark_text,
            (x, y),
            font,
            font_scale,
            (255, 255, 255),
            thickness,
            cv2.LINE_AA,
        )

        out.write(frame)

    cap.release()
    out.release()


if __name__ == "__main__":
    main()
