"""
PDF generation for order reports.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from io import BytesIO
from datetime import datetime


def generate_orders_pdf(orders, filters=None):
    """
    Generate PDF report for orders.
    
    Args:
        orders: QuerySet of orders
        filters: Dict with filter parameters
    
    Returns:
        BytesIO: PDF file content
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=1*cm,
        leftMargin=1*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=20,
        alignment=1
    )
    
    title = Paragraph("Rapport des Commandes - Gapal du Faso", title_style)
    elements.append(title)
    
    # Filters info
    if filters:
        filter_text = []
        if filters.get('start_date'):
            filter_text.append(f"Du: {filters['start_date']}")
        if filters.get('end_date'):
            filter_text.append(f"Au: {filters['end_date']}")
        if filters.get('delivery_status'):
            filter_text.append(f"Statut livraison: {filters['delivery_status']}")
        if filters.get('payment_status'):
            filter_text.append(f"Statut paiement: {filters['payment_status']}")
        
        if filter_text:
            filter_para = Paragraph(" | ".join(filter_text), styles['Normal'])
            elements.append(filter_para)
            elements.append(Spacer(1, 0.5*cm))
    
    # Summary statistics
    total_orders = len(orders)
    total_revenue = sum(order.total_price for order in orders)
    paid_orders = sum(1 for order in orders if order.payment_status == 'payee')
    
    summary_data = [
        ['Total Commandes', 'Revenus Total', 'Commandes Payées'],
        [str(total_orders), f'{int(total_revenue):,} FCFA', f'{paid_orders}/{total_orders}']
    ]
    
    summary_table = Table(summary_data, colWidths=[6*cm, 6*cm, 6*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#eff6ff')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 1*cm))
    
    # Orders table
    table_data = [['N° Commande', 'Client', 'Téléphone', 'Livraison', 'Total', 'Statut Livr.', 'Statut Paie.', 'Priorité']]
    
    for order in orders:
        table_data.append([
            order.order_number,
            order.client_name[:20],
            order.client_phone,
            order.delivery_date.strftime('%d/%m/%Y'),
            f'{int(order.total_price):,}',
            order.get_delivery_status_display()[:10],
            order.get_payment_status_display()[:10],
            order.get_priority_display()
        ])
    
    col_widths = [3.5*cm, 4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm]
    orders_table = Table(table_data, colWidths=col_widths)
    
    orders_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]))
    
    elements.append(orders_table)
    
    # Footer
    elements.append(Spacer(1, 1*cm))
    footer_text = f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} - Gapal du Faso"
    footer = Paragraph(footer_text, styles['Normal'])
    elements.append(footer)
    
    doc.build(elements)
    
    buffer.seek(0)
    return buffer
