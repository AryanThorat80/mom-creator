import asyncio
import os
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile

from google import genai
from supabase import Client

from app.core.config import get_settings


settings = get_settings()

VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
    ".m4v",
}


async def transcribe_audio(
    supabase: Client,
    bucket: str,
    path: str,
) -> str:
    """
    Download an audio/video recording from Supabase,
    convert video to audio when necessary,
    then transcribe using Gemini 3.5 Transcribe.

    Gemini Files API is used so recordings are not sent as
    a large multipart request to the transcription endpoint.
    """

    if not settings.ai_api_key:
        raise RuntimeError(
            "AI_API_KEY is not configured for Gemini transcription"
        )

    print(
        "Downloading recording for Gemini transcription: "
        f"bucket={bucket}, path={path}"
    )

    file_bytes = (
        supabase.storage
        .from_(bucket)
        .download(path)
    )

    if not file_bytes:
        raise ValueError(
            "Unable to download source recording"
        )

    source_size = len(file_bytes)
    print(
        "Source recording size: "
        f"{source_size / (1024 * 1024):.2f} MiB"
    )

    suffix = Path(path).suffix.lower() or ".bin"

    temp_path = None
    audio_path = None
    uploaded_file_name = None

    try:
        with NamedTemporaryFile(
            suffix=suffix,
            delete=False,
        ) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name

        # ----------------------------------------------------
        # Video -> Audio
        # ----------------------------------------------------

        if suffix in VIDEO_EXTENSIONS:
            print(
                "Video detected. Extracting speech-friendly audio "
                "with FFmpeg..."
            )

            audio_path = await extract_audio_from_video(
                temp_path
            )
            transcription_path = audio_path
        else:
            transcription_path = temp_path

        # ----------------------------------------------------
        # Gemini transcription
        # ----------------------------------------------------

        transcript, uploaded_file_name = await transcribe_file(
            transcription_path
        )

        transcript = transcript.strip()

        if not transcript:
            raise ValueError(
                "Gemini returned an empty transcription"
            )

        print(
            "Gemini transcription completed: "
            f"{len(transcript)} characters"
        )

        return transcript

    finally:
        # Remove local files.
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)

        # Remove temporary Gemini Files API object.
        if uploaded_file_name:
            try:
                client = genai.Client(
                    api_key=settings.ai_api_key
                )
                await asyncio.to_thread(
                    client.files.delete,
                    name=uploaded_file_name,
                )
            except Exception as exc:
                print(
                    "Warning: failed to delete temporary Gemini file: "
                    f"{exc}"
                )


async def transcribe_file(
    file_path: str,
) -> tuple[str, str | None]:
    """
    Upload a local audio file to the Gemini Files API and
    transcribe it using Gemini 3.5 Transcribe.

    Returns:
        (transcript, uploaded_gemini_file_name)
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(
            f"Audio file not found: {file_path}"
        )

    client = genai.Client(
        api_key=settings.ai_api_key
    )

    uploaded_file = None

    try:
        print(
            "Uploading recording to Gemini Files API: "
            f"{file_path}"
        )

        uploaded_file = await asyncio.to_thread(
            client.files.upload,
            file=file_path,
        )

        if not uploaded_file:
            raise RuntimeError(
                "Gemini Files API returned no file"
            )

        if not getattr(uploaded_file, "uri", None):
            raise RuntimeError(
                "Gemini Files API returned no file URI"
            )

        mime_type = getattr(
            uploaded_file,
            "mime_type",
            None,
        )

        if not mime_type:
            mime_type = guess_audio_mime_type(file_path)

        print(
            "Gemini file uploaded: "
            f"{getattr(uploaded_file, 'name', 'unknown')}"
        )

        print(
            f"Starting Gemini transcription with "
            f"{settings.transcription_model} "
            "with speaker diarization..."
        )

        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=settings.transcription_model,
            input=[
                {
                    "type": "audio",
                    "uri": uploaded_file.uri,
                    "mime_type": mime_type,
                }
            ],
            generation_config={
                "transcription_config": {
                    "mode": {
                        "type": "verbatim",
                        "diarization_mode": "speaker",
                    },
                },
            },
        )

        transcript = getattr(
            interaction,
            "output_text",
            None,
        )

        if not transcript:
            raise RuntimeError(
                "Gemini returned no transcription text"
            )

        return (
            transcript,
            getattr(uploaded_file, "name", None),
        )

    except Exception:
        # The caller's finally block cannot delete this file unless
        # we return its name, so clean it here on failure.
        if uploaded_file and getattr(
            uploaded_file,
            "name",
            None,
        ):
            try:
                await asyncio.to_thread(
                    client.files.delete,
                    name=uploaded_file.name,
                )
            except Exception:
                pass
        raise


def guess_audio_mime_type(file_path: str) -> str:
    """Return a Gemini-supported MIME type based on the file extension."""

    mime_types = {
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
        ".m4a": "audio/m4a",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
        ".aiff": "audio/aiff",
        ".opus": "audio/opus",
        ".mpga": "audio/mpeg",
        ".mpeg": "audio/mpeg",
    }

    suffix = Path(file_path).suffix.lower()

    return mime_types.get(
        suffix,
        "application/octet-stream",
    )


async def extract_audio_from_video(
    video_path: str,
) -> str:
    """
    Extract speech-friendly audio from video using FFmpeg.

    Uses subprocess.run in a worker thread rather than
    asyncio.create_subprocess_exec so it works reliably on
    the current Windows/Python environment.
    """

    video = Path(video_path)

    if not video.exists():
        raise FileNotFoundError(
            f"Video file not found: {video_path}"
        )

    audio_path = video.with_suffix(".mp3")

    def run_ffmpeg() -> None:
        result = subprocess.run(
            [
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
                "64k",
                str(audio_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

        if result.returncode != 0:
            error_message = result.stderr.decode(
                "utf-8",
                errors="ignore",
            )

            raise RuntimeError(
                "FFmpeg audio extraction failed: "
                + error_message[-2000:]
            )

    await asyncio.to_thread(run_ffmpeg)

    if not audio_path.exists():
        raise RuntimeError(
            "FFmpeg completed but audio file was not created"
        )

    return str(audio_path)
