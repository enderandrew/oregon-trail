CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    profession TEXT,
    status TEXT,
    date TEXT,
    difficulty TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed with Default Scores
INSERT INTO scores (name, score, profession, status, date) VALUES ('R. Philip Bouchard', 99999, 'Gamer', 'Coding', '08/12/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Baron Von Wagon', 10000, 'Banker', 'Rich', '05/01/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Jesus', 7500, 'Carpenter', 'Risen', '04/13/0033');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Kraven', 6000, 'Hunter', 'Bloody', '06/20/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Lucy Boerin', 5000, 'Farmer', 'Trapped', '07/04/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Doctor Nick', 4000, 'Doctor', 'Hurting', '03/15/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Inna Stitch', 3000, 'Tailor', 'Suitable', '09/10/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Dora the Explorer', 2000, 'Guide', 'Lost', '02/28/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Elisa Esposito', 1000, 'Fisherman', 'Enamored', '11/11/1848');
INSERT INTO scores (name, score, profession, status, date) VALUES ('Moe Ron', 120, 'Prospector', 'Dead', '12/25/1848');