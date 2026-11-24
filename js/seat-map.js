import {
    CONFIG,
    SEAT_STATUS
} from "./config.js";

export class SeatMap {
    constructor(container, {
        mode = "user",
        onSelectionChange = () => {}
    } = {}) {
        this.container = container;
        this.mode = mode;
        this.onSelectionChange = onSelectionChange;
        this.seats = [];
        this.selectedIds = new Set();
        this.disabled = false;
    }

    setSeats(seats) {
        this.seats = [...seats].sort(
            (a, b) => a.seatNumber - b.seatNumber
        );

        this.selectedIds.clear();
        this.render();
        this.emitSelection();
    }

    setMode(mode) {
        this.mode = mode;
        this.clearSelection();
    }

    setDisabled(disabled) {
        this.disabled = disabled;
        this.render();
    }

    getSelectedIds() {
        return [...this.selectedIds];
    }

    getSelectedSeats() {
        return this.seats.filter(
            seat => this.selectedIds.has(seat.id)
        );
    }

    clearSelection() {
        this.selectedIds.clear();
        this.render();
        this.emitSelection();
    }

    emitSelection() {
        this.onSelectionChange(this.getSelectedSeats());
    }

    canSelect(seat) {
        if (this.disabled) return false;

        switch (this.mode) {
            case "user":
            case "reserve":
                return seat.status === SEAT_STATUS.AVAILABLE;

            case "release":
                return seat.status === SEAT_STATUS.RESERVED_BY_ADMIN;

            default:
                return false;
        }
    }

    getSeatState(seat) {
        if (this.selectedIds.has(seat.id)) {
            return "selected";
        }

        if (seat.status === SEAT_STATUS.AVAILABLE) {
            return "available";
        }

        if (
            this.mode !== "user" &&
            this.mode !== "view" &&
            seat.status === SEAT_STATUS.RESERVED_BY_ADMIN
        ) {
            return "reserved";
        }

        return "occupied";
    }

    toggleSeat(seat) {
        if (!this.canSelect(seat)) return;

        if (this.selectedIds.has(seat.id)) {
            this.selectedIds.delete(seat.id);
        } else {
            if (this.mode === "user") {
                this.selectedIds.clear();
            }

            this.selectedIds.add(seat.id);
        }

        this.render();

        this.container
            .querySelector(`[data-seat-id="${seat.id}"]`)
            ?.focus({ preventScroll: true });

        this.emitSelection();
    }

    createSeat(seat) {
        const button = document.createElement("button");

        const state = this.getSeatState(seat);

        const labels = {
            available: "פנוי",
            occupied: "תפוס",
            reserved: "משוריין",
            selected: "נבחר"
        };

        button.type = "button";
        button.className = `seat seat-${state}`;
        button.dataset.seatId = String(seat.id);
        button.textContent = String(seat.seatNumber);
        button.disabled = !this.canSelect(seat);

        button.title = `כיסא ${seat.seatNumber} - ${labels[state]}`;

        button.setAttribute("aria-label", button.title);

        button.setAttribute(
            "aria-pressed",
            String(this.selectedIds.has(seat.id))
        );

        button.addEventListener(
            "click",
            () => this.toggleSeat(seat)
        );

        return button;
    }

    render() {
        this.container.replaceChildren();

        if (!this.seats.length) {
            const empty = document.createElement("p");

            empty.className = "empty-state";
            empty.textContent = "אין מקומות להצגה.";

            this.container.append(empty);
            return;
        }

        const hall = document.createElement("div");
        hall.className = "hall-map";

        const stage = document.createElement("div");
        stage.className = "hall-stage";
        stage.textContent = "במה";

        hall.append(stage);

        const scroll = document.createElement("div");
        scroll.className = "hall-scroll";

        const rows = document.createElement("div");
        rows.className = "hall-rows";

        const perRow = CONFIG.SEATS_PER_ROW;
        const half = perRow / 2;

        rows.style.setProperty("--seats-per-side", half);

        for (let index = 0; index < this.seats.length; index += perRow) {
            const row = document.createElement("div");
            row.className = "seat-row";

            const rowLabel = document.createElement("span");
            rowLabel.className = "row-label";
            rowLabel.textContent = String(index / perRow + 1);
            rowLabel.title = `שורה ${rowLabel.textContent}`;

            const rightSide = document.createElement("div");
            rightSide.className = "seat-group";

            const leftSide = document.createElement("div");
            leftSide.className = "seat-group";

            const rowSeats = this.seats.slice(index, index + perRow);

            for (let position = 0; position < perRow; position++) {
                const group = position < half
                    ? rightSide
                    : leftSide;

                const seat = rowSeats[position];

                if (seat) {
                    group.append(this.createSeat(seat));
                } else {
                    const placeholder = document.createElement("span");

                    placeholder.className = "seat-placeholder";
                    placeholder.setAttribute("aria-hidden", "true");

                    group.append(placeholder);
                }
            }

            const aisle = document.createElement("span");
            aisle.className = "hall-aisle";
            aisle.setAttribute("aria-hidden", "true");

            row.append(rowLabel, rightSide, aisle, leftSide);
            rows.append(row);
        }

        scroll.append(rows);
        hall.append(scroll);

        const legend = document.createElement("div");
        legend.className = "seat-legend";

        const states = [
            ["available", "מקום פנוי"],
            ["occupied", "מקום תפוס"],
            ["selected", "מקום נבחר"]
        ];

        if (this.mode === "reserve" || this.mode === "release") {
            states.push(["reserved", "משוריין על ידי המנהל"]);
        }

        for (const [state, label] of states) {
            const item = document.createElement("span");

            item.className = "legend-item";

            const sample = document.createElement("span");
            sample.className = `legend-sample seat-${state}`;

            item.append(sample, document.createTextNode(label));
            legend.append(item);
        }

        hall.append(legend);
        this.container.append(hall);
    }
}