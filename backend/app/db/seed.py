"""
Seed script: inserts 20 test resources.
5 study rooms, 5 labs, 5 sports courts, 5 seminar halls.

Usage (from backend/ directory):
    python -m app.db.seed

Idempotent: skips insert if resources already exist (safe to re-run).

MD NOTE: The MD said "Seed 20 test resources" but provided no actual data.
This is the complete implementation.
"""

import asyncio
import json
from app.db.base import AsyncSessionLocal
from app.db.models import ResourceRow


RESOURCES = [
    # ── Study Rooms ─────────────────────────────────────────────────────────
    {
        "name": "North Library — Room 101",
        "type": "STUDY_ROOM",
        "capacity": 6,
        "location": "North Quad",
        "amenities": ["WiFi", "Whiteboard", "Power Outlets"],
    },
    {
        "name": "North Library — Room 102",
        "type": "STUDY_ROOM",
        "capacity": 4,
        "location": "North Quad",
        "amenities": ["WiFi", "Monitor"],
    },
    {
        "name": "South Library — Room 201",
        "type": "STUDY_ROOM",
        "capacity": 8,
        "location": "South Campus",
        "amenities": ["WiFi", "Whiteboard", "Projector"],
    },
    {
        "name": "South Library — Room 202",
        "type": "STUDY_ROOM",
        "capacity": 4,
        "location": "South Campus",
        "amenities": ["WiFi"],
    },
    {
        "name": "Central Library — Silent Room",
        "type": "STUDY_ROOM",
        "capacity": 2,
        "location": "Main Block",
        "amenities": ["WiFi", "Power Outlets"],
    },

    # ── Labs ────────────────────────────────────────────────────────────────
    {
        "name": "Engineering Lab A",
        "type": "LAB",
        "capacity": 20,
        "location": "Engineering Block",
        "amenities": ["Computers", "Lab Equipment", "3D Printer"],
    },
    {
        "name": "Engineering Lab B",
        "type": "LAB",
        "capacity": 20,
        "location": "Engineering Block",
        "amenities": ["Computers", "Oscilloscopes"],
    },
    {
        "name": "Computer Science Lab 1",
        "type": "LAB",
        "capacity": 30,
        "location": "CS Block",
        "amenities": ["Computers", "High-Speed Internet", "Dual Monitors"],
    },
    {
        "name": "Chemistry Lab",
        "type": "LAB",
        "capacity": 15,
        "location": "Science Block",
        "amenities": ["Safety Equipment", "Fume Hood", "Lab Benches"],
    },
    {
        "name": "Physics Lab",
        "type": "LAB",
        "capacity": 15,
        "location": "Science Block",
        "amenities": ["Measurement Equipment", "Lab Benches"],
    },

    # ── Sports Courts ────────────────────────────────────────────────────────
    {
        "name": "Basketball Court 1",
        "type": "SPORTS",
        "capacity": 10,
        "location": "Sports Complex",
        "amenities": ["Changing Rooms", "Equipment Rental"],
    },
    {
        "name": "Basketball Court 2",
        "type": "SPORTS",
        "capacity": 10,
        "location": "Sports Complex",
        "amenities": ["Changing Rooms"],
    },
    {
        "name": "Badminton Court A",
        "type": "SPORTS",
        "capacity": 4,
        "location": "Indoor Sports Hall",
        "amenities": ["Rackets Available", "Shuttlecocks"],
    },
    {
        "name": "Badminton Court B",
        "type": "SPORTS",
        "capacity": 4,
        "location": "Indoor Sports Hall",
        "amenities": ["Rackets Available"],
    },
    {
        "name": "Swimming Pool Lane",
        "type": "SPORTS",
        "capacity": 2,
        "location": "Aquatic Centre",
        "amenities": ["Lockers", "Shower Facilities"],
    },

    # ── Seminar Halls ─────────────────────────────────────────────────────
    {
        "name": "Seminar Hall A",
        "type": "SEMINAR",
        "capacity": 60,
        "location": "Main Block",
        "amenities": ["Projector", "AC", "Microphone", "Podium"],
    },
    {
        "name": "Seminar Hall B",
        "type": "SEMINAR",
        "capacity": 80,
        "location": "Main Block",
        "amenities": ["Dual Projectors", "AC", "Microphone", "Live Streaming"],
    },
    {
        "name": "Conference Room 301",
        "type": "SEMINAR",
        "capacity": 30,
        "location": "Admin Block",
        "amenities": ["Video Conferencing", "Whiteboard", "AC"],
    },
    {
        "name": "Conference Room 302",
        "type": "SEMINAR",
        "capacity": 25,
        "location": "Admin Block",
        "amenities": ["Projector", "Whiteboard"],
    },
    {
        "name": "Lecture Hall LH-1",
        "type": "SEMINAR",
        "capacity": 150,
        "location": "Academic Block",
        "amenities": ["Projector", "AC", "Microphone", "Recording System"],
    },
]


async def seed():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Idempotency check — don't insert if already seeded
            from sqlalchemy import select, func
            result = await session.execute(select(func.count()).select_from(ResourceRow))
            count = result.scalar()

            if count > 0:
                print(f"[seed] Skipping: {count} resources already exist.")
                return

            rows = [ResourceRow(**r) for r in RESOURCES]
            session.add_all(rows)

        print(f"[seed] Inserted {len(RESOURCES)} resources.")
        for r in RESOURCES:
            print(f"  ✅ {r['type']:<12} {r['name']}")


if __name__ == "__main__":
    asyncio.run(seed())