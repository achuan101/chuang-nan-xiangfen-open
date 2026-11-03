# -*- coding: utf-8 -*-
"""
expand_corpus_dialogues.py
Updates assets/tables/corpus.json with 100 unique dialogues per guest.
"""
import json
import os
import sys

# Ensure tools directory is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

from dialogue_data_1 import GUEST_WALK, GUEST_STUDENT, GUEST_TEA, GUEST_COMMUTER
from dialogue_data_2 import GUEST_AFTERNOON, GUEST_NIGHT, GUEST_FLOWER, GUEST_ARTISAN
from dialogue_data_3 import GUEST_POETRY, GUEST_BOOK, GUEST_FRUIT

ALL_DIALOGUES = {
    "guest_walk": GUEST_WALK,
    "guest_student": GUEST_STUDENT,
    "guest_tea": GUEST_TEA,
    "guest_commuter": GUEST_COMMUTER,
    "guest_afternoon": GUEST_AFTERNOON,
    "guest_night": GUEST_NIGHT,
    "guest_flower": GUEST_FLOWER,
    "guest_artisan": GUEST_ARTISAN,
    "guest_poetry": GUEST_POETRY,
    "guest_book": GUEST_BOOK,
    "guest_fruit": GUEST_FRUIT,
}

CORPUS_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tables', 'corpus.json')

def main():
    print(f"Reading corpus from: {CORPUS_PATH}")
    with open(CORPUS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    guests = data.get('guests', {})
    print(f"Existing guests in corpus: {list(guests.keys())}")

    errors = []
    for guest_id, dialogues in ALL_DIALOGUES.items():
        if len(dialogues) != 100:
            errors.append(f"Guest {guest_id} has {len(dialogues)} dialogues, expected 100")
        unique_dialogues = set(dialogues)
        if len(unique_dialogues) != len(dialogues):
            errors.append(f"Guest {guest_id} has {len(dialogues) - len(unique_dialogues)} duplicate dialogues")

        for idx, line in enumerate(dialogues):
            if not line or not isinstance(line, str):
                errors.append(f"Guest {guest_id} line {idx} is empty or not string: {line}")
            elif len(line) > 55:
                errors.append(f"Guest {guest_id} line {idx} is too long ({len(line)} chars): {line}")

        if guest_id not in guests:
            errors.append(f"Guest {guest_id} not found in corpus.json guests")

    if errors:
        print("Validation errors encountered:")
        for err in errors:
            print(f" - {err}")
        sys.exit(1)

    print("All 11 guests passed validation (100 unique lines each, total 1100 lines).")

    # Update dialogues in corpus data
    for guest_id, dialogues in ALL_DIALOGUES.items():
        guests[guest_id]['dialogues'] = dialogues

    # Write updated corpus back
    with open(CORPUS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully updated {CORPUS_PATH} with 100 dialogues for each of the 11 guests!")

if __name__ == '__main__':
    main()
