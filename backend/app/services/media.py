import asyncio
import os
from pathlib import Path


async def extract_audio_from_video(
    video_path: str,
) -> str:
    """
    Extract speech-friendly audio from a video using FFmpeg.

    Output:
    - mono
    - 16 kHz
    - MP3
    - 48 kbps

    The output is intentionally compressed so that long meetings
    are less likely to exceed transcription-provider file limits.
    """

    video = Path(video_path)

    if not video.exists():
        raise FileNotFoundError(
            f"Video file not found: {video_path}"
        )

    audio_path = video.with_suffix(".mp3")

    process = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-i",
        str(video),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        str(audio_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_message = stderr.decode(
            "utf-8",
            errors="ignore",
        )

        raise RuntimeError(
            "FFmpeg audio extraction failed: "
            + error_message[-2000:]
        )

    if not audio_path.exists():
        raise RuntimeError(
            "FFmpeg completed but audio file was not created"
        )

    return str(audio_path)