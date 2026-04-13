import os
import psycopg2

def drop_column():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/interview_copilot")
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE colleges DROP COLUMN plan_type;")
        conn.commit()
        print("Column dropped successfully")
    except Exception as e:
        print("Failed or column doesn't exist:", e)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    drop_column()
