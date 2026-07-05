import sqlite3
import sqlite_vec
import json

def get_vec_db(path="journal.db"):
    db = sqlite3.connect(path)
    db.enable_load_extension(True)
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    db.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_entries USING vec0(
            entry_id INTEGER PRIMARY KEY,
            embedding FLOAT[768]
        )
    """)  # 768 = nomic-embed-text's output dimension
    return db
