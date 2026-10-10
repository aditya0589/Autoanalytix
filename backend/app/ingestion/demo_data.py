import os
import random
import csv
from datetime import datetime, timedelta
from app.core.config import settings

def generate_demo_dataset() -> str:
    """
    Generates a realistic B2B SaaS & Tech Sales CSV dataset with 1,200 orders,
    realistic revenue, profit margins, regional trends, and temporal coverage across 2025-2026.
    Uses standard library csv writer for zero dependency issues.
    """
    demo_dir = os.path.join(settings.STORAGE_DIR, "demo")
    os.makedirs(demo_dir, exist_ok=True)
    demo_file = os.path.join(demo_dir, "b2b_saas_sales_2025_2026.csv")
    
    if os.path.exists(demo_file):
        return demo_file

    random.seed(42)

    customers = [
        ("Acme Corp", "Enterprise"),
        ("Globex Technologies", "Enterprise"),
        ("Soylent Health", "Mid-Market"),
        ("Initech Systems", "SMB"),
        ("Umbrella Cloud", "Enterprise"),
        ("Stark Data Labs", "Enterprise"),
        ("Wayne Analytics", "Enterprise"),
        ("Cyberdyne Dynamics", "Mid-Market"),
        ("Hooli Apps", "Mid-Market"),
        ("Pied Piper AI", "SMB"),
        ("Massive Dynamic", "Enterprise"),
        ("Dunder Mifflin Tech", "SMB"),
        ("Vandelay Industries", "SMB"),
        ("Sterling Cooper Data", "Mid-Market"),
        ("Wonka Software", "SMB")
    ]

    categories = {
        "Cloud Analytics": [("Autoanalytix Pro", 1200), ("Autoanalytix Enterprise", 3500), ("Insight Dashboard Builder", 800)],
        "AI & Machine Learning": [("AI Copilot Add-on", 950), ("GenAI Agent Engine", 2400), ("Predictive Model Hub", 1800)],
        "Data Infrastructure": [("DuckDB Cloud Lake", 650), ("Vector Database Tier", 1100), ("High-Throughput Ingestion", 1500)],
        "Enterprise Security": [("BYOK Secret Manager", 500), ("SSO & Audit Vault", 750), ("Role Governance Suite", 1200)]
    }

    regions = ["North America", "Europe", "Asia Pacific", "Latin America"]

    start_date = datetime(2025, 1, 1)
    end_date = datetime(2026, 9, 30)
    total_days = (end_date - start_date).days

    fieldnames = [
        "order_id", "order_date", "customer_name", "region", "segment",
        "category", "product_name", "quantity", "unit_price", "discount_rate",
        "revenue", "profit", "churn_risk"
    ]

    rows = []
    order_id_counter = 10001

    for _ in range(1200):
        day_offset = random.randint(0, total_days)
        order_date = start_date + timedelta(days=day_offset)
        
        cust_name, segment = random.choice(customers)
        region = random.choice(regions)
        category = random.choice(list(categories.keys()))
        product_name, base_price = random.choice(categories[category])
        
        quantity = random.randint(1, 8) if segment != "Enterprise" else random.randint(3, 20)
        discount_rate = round(random.choice([0.0, 0.05, 0.10, 0.15, 0.20, 0.25]), 2)
        
        gross = base_price * quantity
        revenue = round(gross * (1.0 - discount_rate), 2)
        
        cost_ratio = random.uniform(0.20, 0.45)
        cost = round(revenue * cost_ratio, 2)
        profit = round(revenue - cost, 2)
        
        churn_risk = "Low" if revenue > 5000 else random.choice(["Low", "Low", "Medium", "High"])

        rows.append({
            "order_id": f"ORD-{order_id_counter}",
            "order_date": order_date.strftime("%Y-%m-%d"),
            "customer_name": cust_name,
            "region": region,
            "segment": segment,
            "category": category,
            "product_name": product_name,
            "quantity": quantity,
            "unit_price": base_price,
            "discount_rate": discount_rate,
            "revenue": revenue,
            "profit": profit,
            "churn_risk": churn_risk
        })
        order_id_counter += 1

    with open(demo_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return demo_file
