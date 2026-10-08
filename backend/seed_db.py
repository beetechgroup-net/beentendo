import json
import subprocess
import os
import sys

def escape_sql_str(val):
    if val is None:
        return 'NULL'
    # Use dollar-quoting or quote escaping
    escaped = val.replace("'", "''")
    return f"'{escaped}'"

def escape_sql_num(val):
    if val is None:
        return 'NULL'
    return str(val)

def restore_database(db_name):
    json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'games.json'))
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found")
        sys.exit(1)

    print(f"Loading JSON from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    games = data.get('games', [])
    print(f"Found {len(games)} games to populate into database '{db_name}'.")

    # Build SQL script
    sql_lines = []
    sql_lines.append("BEGIN;")
    
    # DDL
    sql_lines.append("""
CREATE TABLE IF NOT EXISTS game (
    id BIGINT NOT NULL PRIMARY KEY,
    nsuid VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    cover_image TEXT
);

CREATE TABLE IF NOT EXISTS price_record (
    id BIGINT NOT NULL PRIMARY KEY,
    game_id BIGINT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    regular_price NUMERIC(10, 2) NOT NULL,
    sale_price NUMERIC(10, 2),
    currency VARCHAR(255) NOT NULL DEFAULT 'BRL',
    recorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS game_SEQ START WITH 1 INCREMENT BY 50;
CREATE SEQUENCE IF NOT EXISTS price_record_SEQ START WITH 1 INCREMENT BY 50;

TRUNCATE TABLE price_record, game RESTART IDENTITY CASCADE;
""")

    # Insert Games in batches of 500
    game_rows = []
    price_rows = []

    for game in games:
        gid = game['id']
        nsuid = escape_sql_str(game.get('nsuid'))
        name = escape_sql_str(game.get('name'))
        platform = escape_sql_str(game.get('platform'))
        cover_image = escape_sql_str(game.get('coverImage'))
        
        game_rows.append(f"({gid}, {nsuid}, {name}, {platform}, {cover_image})")

        for price in game.get('prices', []):
            pid = price['id']
            reg_price = escape_sql_num(price.get('regularPrice'))
            sale_price = escape_sql_num(price.get('salePrice'))
            currency = escape_sql_str(price.get('currency', 'BRL'))
            recorded_at = escape_sql_str(price.get('recordedAt'))

            price_rows.append(f"({pid}, {gid}, {reg_price}, {sale_price}, {currency}, {recorded_at}::timestamp)")

    # Batch game inserts
    batch_size = 500
    for i in range(0, len(game_rows), batch_size):
        batch = game_rows[i:i+batch_size]
        sql_lines.append(f"INSERT INTO game (id, nsuid, name, platform, cover_image) VALUES\n" + ",\n".join(batch) + ";")

    # Batch price inserts
    for i in range(0, len(price_rows), batch_size):
        batch = price_rows[i:i+batch_size]
        sql_lines.append(f"INSERT INTO price_record (id, game_id, regular_price, sale_price, currency, recorded_at) VALUES\n" + ",\n".join(batch) + ";")

    # Update sequences
    sql_lines.append("""
SELECT setval('game_SEQ', (SELECT COALESCE(MAX(id), 1) + 50 FROM game));
SELECT setval('price_record_SEQ', (SELECT COALESCE(MAX(id), 1) + 50 FROM price_record));
COMMIT;
""")

    full_sql = "\n".join(sql_lines)
    print(f"Generated SQL script with {len(sql_lines)} statements. Executing via docker psql...")

    cmd = ["docker", "exec", "-i", "beetendo-postgres", "psql", "-U", "postgres", "-d", db_name]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(input=full_sql)

    if proc.returncode != 0:
        print(f"Error restoring database '{db_name}':")
        print(stderr)
        sys.exit(1)
    else:
        print(f"Database '{db_name}' restored successfully!")
        print(stdout[-300:] if len(stdout) > 300 else stdout)

if __name__ == '__main__':
    restore_database('beentendo')
    restore_database('beetendo')
