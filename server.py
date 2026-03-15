from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

YDL_OPTS_BASE = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "format": "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio",
}


def _search(query: str, limit: int):
    opts = {
        **YDL_OPTS_BASE,
        "extract_flat": "in_playlist",
        "default_search": f"ytsearch{limit}",
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(query, download=False)
    entries = info.get("entries", []) if info else []
    results = []
    for e in entries:
        if not e:
            continue
        results.append({
            "id": e.get("id", ""),
            "title": e.get("title", "Untitled"),
            "artist": e.get("uploader") or e.get("channel") or "YouTube",
            "duration": e.get("duration") or 0,
            "thumbnail": e.get("thumbnail") or (
                f"https://i.ytimg.com/vi/{e.get('id', '')}/hqdefault.jpg"
                if e.get("id") else ""
            ),
        })
    return results


def _stream_url(video_id: str):
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        **YDL_OPTS_BASE,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    # Pick best audio-only format
    formats = info.get("formats", [])
    audio_formats = [
        f for f in formats
        if f.get("acodec") != "none" and f.get("vcodec") == "none" and f.get("url")
    ]
    if not audio_formats:
        # fallback: any format with audio
        audio_formats = [f for f in formats if f.get("acodec") != "none" and f.get("url")]

    if not audio_formats:
        raise ValueError("No audio stream found")

    best = sorted(audio_formats, key=lambda f: f.get("abr") or 0, reverse=True)[0]
    return best["url"]


@app.get("/search")
async def search(q: str = Query(...), limit: int = Query(15, ge=1, le=30)):
    try:
        results = await asyncio.to_thread(_search, q, limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stream/{video_id}")
async def stream(video_id: str):
    try:
        url = await asyncio.to_thread(_stream_url, video_id)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
