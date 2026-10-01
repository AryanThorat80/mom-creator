from __future__ import annotations

import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


# ============================================================
# BRAND
# ============================================================

NAVY = colors.HexColor("#023b77")
TEAL = colors.HexColor("#039583")

LIGHT_TEAL = colors.HexColor("#eaf8f5")
LIGHT_BLUE = colors.HexColor("#edf4fb")

TEXT = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#64748b")
BORDER = colors.HexColor("#c9d8e6")

WHITE = colors.white

PAGE_WIDTH, PAGE_HEIGHT = A4


# ============================================================
# FONT LOADING
# ============================================================

FONT_DIRS = [
    Path(__file__).resolve().parents[2] / "assets" / "fonts",
    Path(__file__).resolve().parents[2] / "fonts",
    Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts",
    Path.home()
    / "AppData"
    / "Local"
    / "Microsoft"
    / "Windows"
    / "Fonts",
]


def _find_font(candidates: list[str]) -> str | None:
    for directory in FONT_DIRS:
        for filename in candidates:
            path = directory / filename
            if path.exists():
                return str(path)

    return None


def _register_fonts() -> tuple[str, str]:
    heading_font = "Helvetica-Bold"
    body_font = "Helvetica"

    kaushan_path = _find_font(
        [
            "KaushanScript-Regular.ttf",
            "Kaushan Script Regular.ttf",
            "KaushanScript.ttf",
        ]
    )

    saved_zero_path = _find_font(
        [
            "SavedByZeroRg.otf",
            "Saved By Zero Rg.otf",
            "SavedByZero-Regular.ttf",
            "SavedByZeroRg.ttf",
            "SAVEDBYZ.TTF",
        ]
    )

    if kaushan_path:
        try:
            pdfmetrics.registerFont(
                TTFont(
                    "KaushanScript",
                    kaushan_path,
                )
            )
            heading_font = "KaushanScript"
        except Exception:
            pass

    if saved_zero_path:
        try:
            pdfmetrics.registerFont(
                TTFont(
                    "SavedByZero",
                    saved_zero_path,
                )
            )
            body_font = "SavedByZero"
        except Exception:
            pass

    return heading_font, body_font


HEADING_FONT, BODY_FONT = _register_fonts()


# ============================================================
# HELPERS
# ============================================================

def _clean(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, (dict, list)):
        return str(value)

    return str(value).strip()


def _paragraph(
    value: Any,
    style: ParagraphStyle,
) -> Paragraph:
    text = _clean(value)

    if not text:
        text = "—"

    text = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )

    return Paragraph(text, style)


def _list_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [
            _clean(item)
            for item in value
            if _clean(item)
        ]

    if isinstance(value, str) and value.strip():
        return [value.strip()]

    return []


def _format_datetime(value: Any) -> str:
    if not value:
        return "Not specified"

    try:
        if isinstance(value, datetime):
            dt = value
        else:
            dt = datetime.fromisoformat(
                str(value).replace("Z", "+00:00")
            )

        return dt.strftime(
            "%d %b %Y, %I:%M %p"
        ).lstrip("0")

    except Exception:
        return _clean(value)


def _format_date(value: Any) -> str:
    if not value:
        return "No due date"

    try:
        if isinstance(value, datetime):
            dt = value
        else:
            dt = datetime.fromisoformat(
                str(value).replace("Z", "+00:00")
            )

        return dt.strftime("%d %b %Y")

    except Exception:
        return _clean(value)


# ============================================================
# STYLES
# ============================================================

def _styles() -> dict[str, ParagraphStyle]:

    return {
        "section": ParagraphStyle(
            "Section",
            fontName=HEADING_FONT,
            fontSize=13,
            leading=16,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceBefore=8,
            spaceAfter=6,
        ),

        "body": ParagraphStyle(
            "Body",
            fontName=BODY_FONT,
            fontSize=8.5,
            leading=12,
            textColor=TEXT,
        ),

        "small": ParagraphStyle(
            "Small",
            fontName=BODY_FONT,
            fontSize=7.2,
            leading=9,
            textColor=TEXT,
        ),

        "muted": ParagraphStyle(
            "Muted",
            fontName=BODY_FONT,
            fontSize=7.5,
            leading=9,
            textColor=MUTED,
        ),

        "table_head": ParagraphStyle(
            "TableHead",
            fontName=BODY_FONT,
            fontSize=7,
            leading=8,
            textColor=WHITE,
        ),

        "table_cell": ParagraphStyle(
            "TableCell",
            fontName=BODY_FONT,
            fontSize=7.2,
            leading=9,
            textColor=TEXT,
        ),

        "table_cell_bold": ParagraphStyle(
            "TableCellBold",
            fontName=BODY_FONT,
            fontSize=7.2,
            leading=9,
            textColor=NAVY,
        ),

        "title": ParagraphStyle(
            "Title",
            fontName=HEADING_FONT,
            fontSize=21,
            leading=25,
            textColor=NAVY,
            alignment=TA_LEFT,
        ),
    }


# ============================================================
# TABLE
# ============================================================

def _table(
    rows: list[list[Any]],
    widths: list[float],
    header: bool = False,
) -> Table:

    if not rows:
        rows = [
            [
                _paragraph(
                    "—",
                    _styles()["body"],
                )
                for _ in widths
            ]
        ]

    converted = []

    for row_index, row in enumerate(rows):

        converted_row = []

        for value in row:

            if isinstance(value, Paragraph):
                converted_row.append(value)

            else:
                style = (
                    _styles()["table_head"]
                    if header and row_index == 0
                    else _styles()["table_cell"]
                )

                converted_row.append(
                    _paragraph(
                        value,
                        style,
                    )
                )

        while len(converted_row) < len(widths):
            converted_row.append(
                _paragraph(
                    "—",
                    _styles()["table_cell"],
                )
            )

        converted.append(
            converted_row[:len(widths)]
        )

    commands = [
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "TOP",
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "BOX",
            (0, 0),
            (-1, -1),
            0.5,
            BORDER,
        ),
        (
            "INNERGRID",
            (0, 0),
            (-1, -1),
            0.25,
            BORDER,
        ),
    ]

    if header:
        commands.extend(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    NAVY,
                ),
            ]
        )

        start_row = 1

    else:
        start_row = 0

    for row_index in range(
        start_row,
        len(converted),
    ):
        if row_index % 2 == 0:
            commands.append(
                (
                    "BACKGROUND",
                    (0, row_index),
                    (-1, row_index),
                    LIGHT_BLUE,
                )
            )

    table = Table(
        converted,
        colWidths=widths,
        repeatRows=1 if header else 0,
    )

    table.setStyle(
        TableStyle(commands)
    )

    return table


# ============================================================
# SECTION TITLE
# ============================================================

def _section_title(
    title: str,
) -> Paragraph:

    return Paragraph(
        _clean(title).upper(),
        _styles()["section"],
    )


# ============================================================
# MEETING OVERVIEW
# ============================================================

def _meeting_overview(
    data: dict[str, Any],
) -> list[tuple[str, str]]:

    meeting = data["meeting"]
    mom = data["mom"]

    return [
        (
            "PROJECT / TOPIC",
            mom.get("title")
            or meeting.get("title")
            or "Minutes of Meeting",
        ),
        (
            "DATE",
            _format_datetime(
                meeting.get("meeting_date")
            ),
        ),
        (
            "LOCATION / MODE",
            meeting.get("mode")
            or "Not specified",
        ),
        (
            "MEETING STATUS",
            mom.get("status")
            or meeting.get("status")
            or "Not specified",
        ),
        (
            "MEETING CALLED BY",
            meeting.get("created_by")
            or "Not specified",
        ),
        (
            "MOM CREATED",
            _format_datetime(
                mom.get("created_at")
                or mom.get("generated_at")
            ),
        ),
    ]


def _render_meeting_overview(
    data: dict[str, Any],
):

    values = _meeting_overview(data)

    rows = []

    for index in range(
        0,
        len(values),
        2,
    ):

        left = values[index]

        right = (
            values[index + 1]
            if index + 1 < len(values)
            else ("", "")
        )

        rows.append(
            [
                _paragraph(
                    left[0],
                    _styles()["muted"],
                ),
                _paragraph(
                    left[1],
                    _styles()["small"],
                ),
                _paragraph(
                    right[0],
                    _styles()["muted"],
                ),
                _paragraph(
                    right[1],
                    _styles()["small"],
                ),
            ]
        )

    return _table(
        rows,
        [
            27 * mm,
            58 * mm,
            27 * mm,
            58 * mm,
        ],
    )


# ============================================================
# PARTICIPANTS
# ============================================================

def _render_participants(
    data: dict[str, Any],
):

    participants = (
        data["meeting"].get("participants")
        or []
    )

    rows = [
        [
            "NAME",
            "EMAIL",
            "ROLE",
        ]
    ]

    for participant in participants:

        rows.append(
            [
                participant.get("name")
                or "—",
                participant.get("email")
                or "—",
                participant.get("role")
                or "—",
            ]
        )

    if len(rows) == 1:
        rows.append(
            [
                "—",
                "—",
                "—",
            ]
        )

    return _table(
        rows,
        [
            65 * mm,
            60 * mm,
            45 * mm,
        ],
        header=True,
    )


# ============================================================
# AGENDA
# ============================================================

def _render_agenda(
    data: dict[str, Any],
):

    mom = data["mom"]

    agenda = (
        mom.get("agenda")
        or mom.get("meeting_agenda")
        or mom.get("topics")
        or []
    )

    values = _list_values(agenda)

    if not values:
        return _table(
            [
                [
                    _paragraph(
                        "No agenda recorded.",
                        _styles()["body"],
                    )
                ]
            ],
            [170 * mm],
        )

    rows = []

    for index, item in enumerate(
        values,
        1,
    ):
        rows.append(
            [
                str(index),
                item,
            ]
        )

    return _table(
        [
            [
                "NO.",
                "AGENDA ITEM",
            ]
        ]
        + rows,
        [
            15 * mm,
            155 * mm,
        ],
        header=True,
    )


# ============================================================
# DISCUSSION
# ============================================================

def _render_discussion(
    data: dict[str, Any],
):

    mom = data["mom"]

    discussion = (
        mom.get("key_discussion_points")
        or []
    )

    values = _list_values(discussion)

    rows = [
        [
            "NO.",
            "TOPIC / DISCUSSION",
        ]
    ]

    for index, item in enumerate(
        values,
        1,
    ):
        rows.append(
            [
                str(index),
                item,
            ]
        )

    if len(rows) == 1:
        rows.append(
            [
                "—",
                "No discussion points recorded.",
            ]
        )

    return _table(
        rows,
        [
            15 * mm,
            155 * mm,
        ],
        header=True,
    )


# ============================================================
# BULLETS
# ============================================================

def _render_bullets(
    values: Any,
):

    items = _list_values(values)

    if not items:
        items = [
            "No information recorded."
        ]

    rows = []

    for item in items:
        rows.append(
            [
                "•",
                item,
            ]
        )

    return _table(
        rows,
        [
            10 * mm,
            160 * mm,
        ],
    )


# ============================================================
# ACTION ITEMS
# ============================================================

def _render_action_items(
    data: dict[str, Any],
):

    items = (
        data.get("action_items")
        or []
    )

    rows = [
        [
            "#",
            "ACTION ITEM",
            "ASSIGNEE",
            "DEADLINE",
            "PRIORITY",
            "STATUS",
        ]
    ]

    for index, item in enumerate(
        items,
        1,
    ):

        rows.append(
            [
                f"{index:02d}",
                item.get("task")
                or "—",
                item.get("assigned_name")
                or "Unassigned",
                _format_date(
                    item.get("due_date")
                ),
                item.get("priority")
                or "—",
                item.get("status")
                or "—",
            ]
        )

    if len(rows) == 1:
        rows.append(
            [
                "—",
                "No action items recorded.",
                "—",
                "—",
                "—",
                "—",
            ]
        )

    return _table(
        rows,
        [
            10 * mm,
            57 * mm,
            28 * mm,
            25 * mm,
            22 * mm,
            28 * mm,
        ],
        header=True,
    )


# ============================================================
# RISKS
# ============================================================

def _render_risks(
    data: dict[str, Any],
):

    mom = data["mom"]

    risks = (
        mom.get("risks")
        or mom.get("risks_and_dependencies")
        or mom.get("dependencies")
        or []
    )

    return _render_bullets(risks)


# ============================================================
# NEXT MEETING
# ============================================================

def _render_next_meeting(
    data: dict[str, Any],
):

    mom = data["mom"]

    next_meeting = (
        mom.get("next_meeting")
        or {}
    )

    if not isinstance(
        next_meeting,
        dict,
    ):
        next_meeting = {}

    rows = [
        [
            "PROPOSED DATE",
            next_meeting.get("date")
            or "—",
            "PROPOSED TIME",
            next_meeting.get("time")
            or "—",
            "PRIMARY OBJECTIVE",
            next_meeting.get("objective")
            or "—",
        ]
    ]

    return _table(
        rows,
        [
            25 * mm,
            30 * mm,
            25 * mm,
            30 * mm,
            30 * mm,
            30 * mm,
        ],
    )


# ============================================================
# SIGN OFF
# ============================================================

def _render_signoff(
    data: dict[str, Any],
):

    meeting = data["meeting"]

    prepared_name = (
        meeting.get("created_by")
        or "—"
    )

    rows = [
        [
            "PREPARED BY",
            "REVIEWED & APPROVED BY",
        ],
        [
            (
                f"Name: {_clean(prepared_name)}"
                "<br/>"
                "Designation: —"
                "<br/><br/>"
                "Signature / Date: ____________________"
            ),
            (
                "Name: —"
                "<br/>"
                "Designation: —"
                "<br/><br/>"
                "Signature / Date: ____________________"
            ),
        ],
    ]

    return _table(
        rows,
        [
            85 * mm,
            85 * mm,
        ],
        header=True,
    )


# ============================================================
# ABBREVIATIONS
# ============================================================

def _render_abbreviations(
    data: dict[str, Any],
):

    abbreviations = (
        data["mom"].get(
            "abbreviations_used"
        )
        or {}
    )

    rows = [
        [
            "ABBREVIATION",
            "MEANING",
        ]
    ]

    if isinstance(
        abbreviations,
        dict,
    ):

        for key, value in abbreviations.items():

            rows.append(
                [
                    key,
                    value,
                ]
            )

    if len(rows) == 1:
        rows.append(
            [
                "—",
                "No abbreviations recorded.",
            ]
        )

    return _table(
        rows,
        [
            45 * mm,
            125 * mm,
        ],
        header=True,
    )


# ============================================================
# SECTION RENDERING
# ============================================================

def _render_section(
    title: str,
    content,
):

    return KeepTogether(
        [
            _section_title(title),
            content,
            Spacer(
                1,
                4 * mm,
            ),
        ]
    )


# ============================================================
# PAGE HEADER / FOOTER
# ============================================================

def _page_decoration(
    canvas,
    document,
):

    canvas.saveState()

    # Header
    canvas.setFillColor(NAVY)

    canvas.rect(
        0,
        PAGE_HEIGHT - 25 * mm,
        PAGE_WIDTH,
        25 * mm,
        fill=1,
        stroke=0,
    )

    # Teal accent
    canvas.setFillColor(TEAL)

    canvas.rect(
        0,
        PAGE_HEIGHT - 27 * mm,
        PAGE_WIDTH,
        2 * mm,
        fill=1,
        stroke=0,
    )

    title = getattr(
        document,
        "report_title",
        "MINUTES OF MEETING",
    )

    canvas.setFont(
        HEADING_FONT,
        16,
    )

    canvas.setFillColor(WHITE)

    canvas.drawString(
        18 * mm,
        PAGE_HEIGHT - 14 * mm,
        title[:65],
    )

    canvas.setFont(
        BODY_FONT,
        6.5,
    )

    canvas.setFillColor(
        colors.HexColor("#d8f7f0")
    )

    canvas.drawRightString(
        PAGE_WIDTH - 18 * mm,
        PAGE_HEIGHT - 14 * mm,
        "MOM CREATOR",
    )

    # Footer
    canvas.setStrokeColor(
        colors.HexColor("#d7e4ed")
    )

    canvas.setLineWidth(0.35)

    canvas.line(
        18 * mm,
        14 * mm,
        PAGE_WIDTH - 18 * mm,
        14 * mm,
    )

    canvas.setFont(
        BODY_FONT,
        6.5,
    )

    canvas.setFillColor(MUTED)

    canvas.drawString(
        18 * mm,
        8.5 * mm,
        "Confidential • Internal Record",
    )

    canvas.drawRightString(
        PAGE_WIDTH - 18 * mm,
        8.5 * mm,
        f"Page {document.page}",
    )

    canvas.restoreState()


# ============================================================
# NORMALIZE PAYLOAD
# ============================================================

def _normalize_payload(
    payload: dict[str, Any],
) -> dict[str, Any]:

    meeting = dict(
        payload.get("meeting")
        or {}
    )

    mom = dict(
        payload.get("mom")
        or {}
    )

    action_items = list(
        payload.get("action_items")
        or []
    )

    participants = list(
        meeting.get("participants")
        or []
    )

    meeting["participants"] = participants

    return {
        "meeting": meeting,
        "mom": mom,
        "action_items": action_items,
        "title": (
            mom.get("title")
            or meeting.get("title")
            or "Minutes of Meeting"
        ),
    }


# ============================================================
# BUILD PDF
# ============================================================

def _build_pdf(
    payload: dict[str, Any],
) -> bytes:

    data = _normalize_payload(
        payload
    )

    buffer = BytesIO()

    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=33 * mm,
        bottomMargin=20 * mm,
        title=data["title"],
        author="MOM Creator",
    )

    document.report_title = data["title"]

    frame = Frame(
        document.leftMargin,
        document.bottomMargin,
        document.width,
        document.height,
        id="main",
    )

    template = PageTemplate(
        id="mom",
        frames=[frame],
        onPage=_page_decoration,
    )

    document.addPageTemplates(
        [template]
    )

    story = []

    # --------------------------------------------------------
    # TITLE
    # --------------------------------------------------------

    story.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    story.append(
        Paragraph(
            "MINUTES OF MEETING",
            _styles()["section"],
        )
    )

    story.append(
        Paragraph(
            _clean(data["title"]),
            _styles()["title"],
        )
    )

    story.append(
        Spacer(
            1,
            2 * mm,
        )
    )

    story.append(
        Paragraph(
            "Generated by MOM Creator",
            _styles()["muted"],
        )
    )

    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    # --------------------------------------------------------
    # MEETING OVERVIEW
    # --------------------------------------------------------

    story.append(
        _render_section(
            "MEETING OVERVIEW",
            _render_meeting_overview(data),
        )
    )

    # --------------------------------------------------------
    # PARTICIPANTS
    # --------------------------------------------------------

    participants = (
        data["meeting"].get("participants")
        or []
    )

    if participants:

        story.append(
            _render_section(
                "PARTICIPANTS",
                _render_participants(data),
            )
        )

    # --------------------------------------------------------
    # AGENDA
    # --------------------------------------------------------

    story.append(
        _render_section(
            "MEETING AGENDA",
            _render_agenda(data),
        )
    )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    summary = (
        data["mom"].get("summary")
        or "No summary recorded."
    )

    story.append(
        _render_section(
            "EXECUTIVE SUMMARY",
            _paragraph(
                summary,
                _styles()["body"],
            ),
        )
    )

    # --------------------------------------------------------
    # DISCUSSION
    # --------------------------------------------------------

    story.append(
        _render_section(
            "KEY DISCUSSION POINTS",
            _render_discussion(data),
        )
    )

    # --------------------------------------------------------
    # DECISIONS
    # --------------------------------------------------------

    story.append(
        _render_section(
            "DECISIONS AGREED UPON",
            _render_bullets(
                data["mom"].get(
                    "decisions"
                )
            ),
        )
    )

    # --------------------------------------------------------
    # ACTION ITEMS
    # --------------------------------------------------------

    story.append(
        _render_section(
            "ACTION ITEMS & OWNERSHIP MATRIX",
            _render_action_items(data),
        )
    )

    # --------------------------------------------------------
    # RISKS
    # --------------------------------------------------------

    risks = (
        data["mom"].get("risks")
        or data["mom"].get(
            "risks_and_dependencies"
        )
        or data["mom"].get(
            "dependencies"
        )
    )

    if risks:

        story.append(
            _render_section(
                "IDENTIFIED RISKS & DEPENDENCIES",
                _render_risks(data),
            )
        )

    # --------------------------------------------------------
    # NEXT MEETING
    # --------------------------------------------------------

    if data["mom"].get(
        "next_meeting"
    ):

        story.append(
            _render_section(
                "NEXT MEETING DETAILS",
                _render_next_meeting(data),
            )
        )

    # --------------------------------------------------------
    # ABBREVIATIONS
    # --------------------------------------------------------

    if data["mom"].get(
        "abbreviations_used"
    ):

        story.append(
            _render_section(
                "ABBREVIATIONS",
                _render_abbreviations(data),
            )
        )

    # --------------------------------------------------------
    # SIGN OFF
    # --------------------------------------------------------

    story.append(
        _render_section(
            "DOCUMENT SIGN-OFF & APPROVAL",
            _render_signoff(data),
        )
    )

    document.build(story)

    return buffer.getvalue()


# ============================================================
# PUBLIC API
# ============================================================

async def generate_reference_pdf(
    reference_bytes: bytes,
    payload: dict[str, Any],
) -> bytes:

    """
    Kept for compatibility with the existing documents route.

    The reference file is intentionally NOT used as content.

    The exported PDF always comes from the current meeting/MOM
    payload so one MOM can never accidentally export another MOM.
    """

    return _build_pdf(payload)


def _render_fallback_pdf(
    payload: dict[str, Any],
) -> bytes:

    return _build_pdf(payload)