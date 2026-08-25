"""Pre-warm script: downloads and loads the Chatterbox model at build time."""
import torch
import functools

_orig = torch.load
def _safe(*a, **kw):
    kw.setdefault('map_location', torch.device('cpu'))
    return _orig(*a, **kw)
torch.load = _safe

try:
    from chatterbox.tts import ChatterboxTTS
    ChatterboxTTS.from_pretrained(device='cpu')
    print('Model pre-warmed successfully.')
except Exception as e:
    print(f'Pre-warm skipped: {e}')
