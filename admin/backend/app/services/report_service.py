from __future__ import annotations

import csv
from io import StringIO
from uuid import UUID

from sqlalchemy.orm import Session

from app.services import student_service, token_service


def _write_csv(headers: list[str], rows: list[list[object]]) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def generate_student_usage_csv(db: Session, college_id: UUID) -> str:
    listing = student_service.list_students(
        db,
        college_id,
        search=None,
        status_filter=None,
        target_company=None,
        target_role=None,
        sort_by="name",
        sort_dir="asc",
        page=1,
        per_page=10000,
    )

    rows: list[list[object]] = []
    for item in listing["students"]:
        detail = student_service.get_student_detail(db, college_id, item["id"])
        rows.append(
            [
                item["full_name"],
                item["email"],
                item["department"] or "",
                item["graduation_year"] or "",
                item["tokens_consumed"],
                detail["resume_summary"]["ats_score"] if detail["resume_summary"]["ats_score"] is not None else "",
                detail["study_plan"]["completion_percentage"] if detail["study_plan"]["completion_percentage"] is not None else "",
                item["last_active_at"] or "",
                item["status"],
            ]
        )

    return _write_csv(
        [
            "Student Name",
            "Email",
            "Department",
            "Graduation Year",
            "Invite Slots Consumed",
            "ATS Score",
            "Study Plan %",
            "Last Active",
            "Status",
        ],
        rows,
    )


def generate_invite_summary_csv(db: Session, college_id: UUID) -> str:
    overview = token_service.get_college_token_pool(db, college_id)

    rows: list[list[object]] = [
        ["College Invite Slots", "Total Allocated", overview["total_allocated"]],
        ["College Invite Slots", "Students Invited", overview["total_consumed"]],
        ["College Invite Slots", "Remaining Slots", overview["balance"]],
        ["College Invite Slots", "Expiry Date", overview["expiry_date"] or ""],
        [],
        ["Student Name", "Email", "Status", "Invited Date"],
    ]

    for item in overview["student_allocations"]:
        rows.append(
            [
                item["name"] or "",
                item["email"] or "",
                item["status"],
                item.get("invited_date") or "",
            ]
        )

    output = StringIO()
    writer = csv.writer(output)
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def generate_readiness_csv(db: Session, college_id: UUID) -> str:
    listing = student_service.list_students(
        db,
        college_id,
        search=None,
        status_filter=None,
        target_company=None,
        target_role=None,
        sort_by="name",
        sort_dir="asc",
        page=1,
        per_page=10000,
    )

    rows: list[list[object]] = []
    for item in listing["students"]:
        detail = student_service.get_student_detail(db, college_id, item["id"])
        rows.append(
            [
                item["full_name"],
                item["email"],
                detail["prep_details"]["target_company"] or "",
                detail["prep_details"]["target_role"] or "",
                detail["resume_summary"]["ats_score"] if detail["resume_summary"]["ats_score"] is not None else "",
                detail["study_plan"]["completion_percentage"] if detail["study_plan"]["completion_percentage"] is not None else "",
                item["tokens_consumed"],
                item["status"],
                item["last_active_at"] or "",
            ]
        )

    return _write_csv(
        [
            "Student Name",
            "Email",
            "Target Company",
            "Target Role",
            "ATS Score",
            "Study Plan %",
            "Invite Slots Consumed",
            "Status",
            "Last Active",
        ],
        rows,
    )
