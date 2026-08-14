import json
from database import SessionLocal
from models import Template

db = SessionLocal()
try:
    templates = db.query(Template).all()
    out = []
    for t in templates:
        out.append({
            "id": t.id,
            "name": t.name,
            "video_url": t.video_url,
            "fields": t.fields
        })
    print(json.dumps(out, indent=2))
finally:
    db.close()
