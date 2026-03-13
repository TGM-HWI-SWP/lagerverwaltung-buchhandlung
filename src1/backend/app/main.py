from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import books, inventory

# TODO: adjust metadata based on project specification
app = FastAPI(
    title="Buchhandlungsverwaltung",
    version="0.1.0",
)

# TODO: configure allowed origins for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])

