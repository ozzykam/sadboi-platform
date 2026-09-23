# Reservations and allocations

Updated September 21, 2026.

Inventory → Reservations protects units at a specific location for a commission, event, wholesale request, or internal hold. A **Reserved** record subtracts from available stock; **Allocated** subtracts from available stock as an assigned commitment. Released and fulfilled records stop holding units while preserving history.

Reservation changes run in a stock transaction. The server rejects a new or edited reservation when it would make available stock negative, so two staff members cannot promise the same units. Physical stock counts and receiving remain separate; reservations do not add or remove on-hand units.
