import sys
from alembic.config import main

if __name__ == '__main__':
    main(argv=['--raiseerr', 'revision', '--autogenerate', '-m', 'remove_plan_type'])
