import json
from database import SessionLocal
from models import Template

db = SessionLocal()
try:
    t = db.query(Template).filter(Template.name == "campinorte").first()
    if t:
        t.video_url = "https://www.youtube.com/watch?v=jfKfPfyJRdk"
        db.commit()
        print("Updated campinorte to Lofi Girl")
    else:
        print("Template not found")
finally:
    db.close()
