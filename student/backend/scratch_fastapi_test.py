from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
response = client.get("/topic/1/java?target_id=8")
print(response.status_code)
print(response.text)
