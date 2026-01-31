"""
Receipt generation for orders.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime


def generate_order_receipt(order):
    """
    Generate a receipt PDF for an order.

    Args:
        order: Order instance

    Returns:
        BytesIO: PDF file content
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    elements = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=20,
        alignment=TA_CENTER
    )

    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=10,
        spaceBefore=10,
        fontName='Helvetica-Bold'
    )

    # Company header
    elements.append(Paragraph("Gapal du Faso", title_style))
    elements.append(Paragraph("Produits Laitiers de Qualité", subtitle_style))
    elements.append(Paragraph("Ouagadougou, Burkina Faso", subtitle_style))
    elements.append(Paragraph("Tél: +226 XX XX XX XX", subtitle_style))

    # Separator line
    elements.append(Spacer(1, 0.5*cm))
    separator = Table([['_' * 80]], colWidths=[16*cm])
    separator.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.grey),
        ('ALIGNMENT', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(separator)
    elements.append(Spacer(1, 0.5*cm))

    # Receipt title
    receipt_title = ParagraphStyle(
        'ReceiptTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.black,
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    elements.append(Paragraph("REÇU DE COMMANDE", receipt_title))

    # Order information
    order_info_data = [
        ['N° Commande:', order.order_number],
        ['Date:', order.created_at.strftime('%d/%m/%Y à %H:%M')],
        ['Date de livraison:', order.delivery_date.strftime('%d/%m/%Y')],
    ]

    order_info_table = Table(order_info_data, colWidths=[5*cm, 11*cm])
    order_info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#1e40af')),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(order_info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Client information
    elements.append(Paragraph("Informations Client", section_title_style))

    client_data = [
        ['Nom:', order.client_name],
        ['Téléphone:', order.client_phone],
        ['Adresse:', order.delivery_address or 'Non spécifiée'],
    ]

    client_table = Table(client_data, colWidths=[5*cm, 11*cm])
    client_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 0.5*cm))

    # Order items
    elements.append(Paragraph("Détail de la Commande", section_title_style))

    # Items table header
    items_data = [['Produit', 'Quantité', 'Prix Unit.', 'Total']]

    # Add items
    for item in order.items.all():
        items_data.append([
            item.product.name,
            f"{int(item.quantity)} {item.product.get_unit_display()}",
            f"{int(item.unit_price):,} FCFA",
            f"{int(item.subtotal):,} FCFA"
        ])

    items_table = Table(items_data, colWidths=[8*cm, 3*cm, 2.5*cm, 2.5*cm])
    items_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),

        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Product name left
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),  # Rest centered
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.5*cm))

    # Totals
    totals_data = [
        ['Total:', f"{int(order.total_price):,} FCFA"],
    ]

    totals_table = Table(totals_data, colWidths=[14*cm, 2*cm])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e40af')),
        ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor('#1e40af')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 0.5*cm))

    # Payment status
    payment_status_color = colors.HexColor('#10b981') if order.payment_status == 'payee' else colors.HexColor('#f59e0b')
    payment_status_data = [
        ['Statut du paiement:', order.get_payment_status_display()],
    ]

    payment_table = Table(payment_status_data, colWidths=[5*cm, 11*cm])
    payment_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (1, 0), (1, -1), payment_status_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    elements.append(payment_table)

    # Delivery status
    delivery_status_color = colors.HexColor('#10b981') if order.delivery_status == 'livree' else colors.HexColor('#3b82f6')
    delivery_status_data = [
        ['Statut de livraison:', order.get_delivery_status_display()],
    ]

    delivery_table = Table(delivery_status_data, colWidths=[5*cm, 11*cm])
    delivery_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (1, 0), (1, -1), delivery_status_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    elements.append(delivery_table)

    # Notes if any
    if order.notes:
        elements.append(Spacer(1, 0.5*cm))
        elements.append(Paragraph("Notes", section_title_style))
        notes_style = ParagraphStyle(
            'Notes',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.grey,
        )
        elements.append(Paragraph(order.notes, notes_style))

    # Footer
    elements.append(Spacer(1, 1*cm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER,
    )
    elements.append(Paragraph(
        f"Reçu généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}",
        footer_style
    ))
    elements.append(Paragraph("Merci pour votre commande!", footer_style))
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("Gapal du Faso - Produits laitiers de qualité", footer_style))

    # Build PDF
    doc.build(elements)

    buffer.seek(0)
    return buffer
