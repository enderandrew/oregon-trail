/**
 * OREGON TRAIL - Just how you remember it
 */

const DEBUG = false;
let isGameStarting = true;
let badWords = [];
let keys = {};
let eventLog = null;
let modalChild = null;
let konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiIndex = 0;
window.addEventListener("keydown", (e) => { 
    keys[e.key] = true; 

    // Check for Konami Code sequence
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            activateCheatCode();
            konamiIndex = 0; // Reset after success
        }
    } else {
        konamiIndex = 0; // Reset on wrong key
    }

    const openedDevTools = e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase())) ||
        (e.metaKey && e.altKey && ["i", "j"].includes(e.key.toLowerCase()));
    if (openedDevTools) {
        AchievementManager.unlock('open_source', 'Open Source');
    }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

let gamepadState = { up: false, down: false, left: false, right: false, connected: false };
const GAMEPAD_DEADZONE = 0.3;

function pollGamepad() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const pad = pads[0]; // first connected controller
    if (pad) {
        gamepadState.connected = true;
        // Standard mapping: D-pad is buttons 12-15, left stick is axes 0-1.
        // Either one works — D-pad for precise finale movement, stick for
        // players who prefer it.
        const stickX = pad.axes[0] || 0;
        const stickY = pad.axes[1] || 0;
        gamepadState.up    = !!(pad.buttons[12] && pad.buttons[12].pressed) || stickY < -GAMEPAD_DEADZONE;
        gamepadState.down  = !!(pad.buttons[13] && pad.buttons[13].pressed) || stickY > GAMEPAD_DEADZONE;
        gamepadState.left  = !!(pad.buttons[14] && pad.buttons[14].pressed) || stickX < -GAMEPAD_DEADZONE;
        gamepadState.right = !!(pad.buttons[15] && pad.buttons[15].pressed) || stickX > GAMEPAD_DEADZONE;
    } else {
        gamepadState.connected = false;
        gamepadState.up = gamepadState.down = gamepadState.left = gamepadState.right = false;
    }
    requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);

let lastTap = 0;
let tapCount = 0;
document.addEventListener("DOMContentLoaded", () => {
    eventLog = document.querySelector(".ongoing-events");
    modalChild = document.querySelector(".modal-child");

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.stopPropagation === 'true') e.stopPropagation();
        const action = btn.dataset.action;
        const handler = ACTION_HANDLERS[action];
        if (!handler) {
            console.error(`No action handler registered for "${action}"`);
            return;
        }
        let args = [];
        if (btn.dataset.args) {
            try {
                args = JSON.parse(btn.dataset.args);
            } catch (err) {
                console.error(`Bad data-args for action "${action}":`, btn.dataset.args, err);
                return;
            }
        }
        handler(...args);
    });

    const wagonBody = document.getElementById('wagon-body');
    if (wagonBody) {
        wagonBody.addEventListener('touchend', (e) => {
            let currentTime = Date.now();
            let tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                tapCount++;
                if (tapCount === 10) { 
                    activateCheatCode();
                    tapCount = 0;
                }
            } else {
                tapCount = 1;
            }
            lastTap = currentTime;
        });
    }
});

function activateCheatCode() {
    if (!wagon.flags) wagon.flags = {};
    wagon.flags.cheated = true;
	AchievementManager.unlock('gameshark', 'Gameshark');
    wagon.characters.forEach(char => {
        char.health = 100;
        char.status = "Good";
        char.isDead = false;
        char.illness = []; 
        
        if (typeof char.healthBar === "function") char.healthBar();
    });

    AudioManager.playSound('Konami'); 
    updateActionPrompt("CHEAT CODE ACTIVATED: All pioneers restored to 100% health. Score tracking disabled.");

    const screen = document.getElementById("game-screen");
    if (screen) {
        screen.style.filter = "invert(1)";
        setTimeout(() => { screen.style.filter = "none"; }, 200);
    }

    if (typeof textUpdateUI === "function") textUpdateUI();
}

const AchievementManager = {
    data: {
        unlocked: [],
        stats: {
            trailsCompleted: [],
            hardTrailsCompleted: [],
            professionsUsed: [],
            huntedAnimals: [],   // Array of animal names/IDs
            craftedItems: [],    // Array of item names
            bunnyDeaths: 0,      // Total across all runs
            partsReplaced: [],   // ['Wheel', 'Axle', 'Tongue']
            tombstonesMourned: 0,// Reset per run
            animalsHuntedThisRun: 0 // Reset per run
        }
    },

    init() {
        const saved = localStorage.getItem('oregon_achievements');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data = { ...this.data, ...parsed };
            this.data.stats = { ...this.data.stats, ...parsed.stats };
        }
        this.save();
    },

    save() {
        localStorage.setItem('oregon_achievements', JSON.stringify(this.data));
    },

    unlock(id, title) {
        if (!this.data.unlocked.includes(id)) {
            this.data.unlocked.push(id);
            this.save();
            this.notify(title);
        }
    },

    notify(title) {
        const notifyEl = document.createElement('div');
        notifyEl.className = 'achievement-popup';
        notifyEl.innerHTML = `
            <div style="color: #ffd700; font-weight: bold;">🏆 ACHIEVEMENT UNLOCKED</div>
            <div style="color: white;">${title}</div>
        `;
        document.body.appendChild(notifyEl);
        
        AudioManager.playSound('achievement'); 
        setTimeout(() => notifyEl.classList.add('fade-out'), 4000);
        setTimeout(() => notifyEl.remove(), 5000);
    }
};

AchievementManager.init();

const TOOLTIP_STYLE_EXCLUDE_IDS = new Set(["oxen-sprite", "wagon-body", "landmark-graphic"]);
const TOOLTIP_STYLE_SKIP_TAGS = new Set(["OPTION", "OPTGROUP", "SELECT"]); // can't hold real child elements
const TOOLTIP_STYLE_WRAP_TAGS = new Set(["IMG", "INPUT", "BR", "HR"]); // void elements: wrap instead of appending a child

function styleTooltipElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (TOOLTIP_STYLE_SKIP_TAGS.has(el.tagName)) return;
    if (el.id && TOOLTIP_STYLE_EXCLUDE_IDS.has(el.id)) return;

    const text = el.getAttribute('title');
    el.removeAttribute('title'); // always strip the native one — never show both at once
    if (!text || !text.trim()) return;

    // Re-run on an element already converted (its title changed again): just
    // sync the existing span's text instead of re-wrapping/re-appending.
    let span = el.__tooltipSpan;
    if (span && span.isConnected) {
        span.textContent = text;
        return;
    }

    span = document.createElement('span');
    span.className = 'tooltiptext';
    span.textContent = text;

    if (TOOLTIP_STYLE_WRAP_TAGS.has(el.tagName)) {
        if (!el.parentNode) return; // detached, nothing to wrap into
        const wrapper = document.createElement('span');
        wrapper.className = 'tooltip-trigger';
        wrapper.style.display = 'inline-block';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        wrapper.appendChild(span);
    } else {
        el.classList.add('tooltip-trigger');
        el.appendChild(span);
    }
    el.__tooltipSpan = span;
}

function styleAllTooltips(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('title')) {
        styleTooltipElement(root);
    }
    if (typeof root.querySelectorAll === 'function') {
        root.querySelectorAll('[title]').forEach(styleTooltipElement);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    styleAllTooltips(document);

    const tooltipObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                styleTooltipElement(mutation.target);
            } else if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(styleAllTooltips);
            }
        }
    });
    tooltipObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title']
    });
});

// --- Hidden Karma ------------------------------------------------------
function adjustKarma(amount) {
    if (!wagon) return;
    if (typeof wagon.karma !== "number") wagon.karma = 0;
    wagon.karma = Math.max(-100, Math.min(100, wagon.karma + amount));
    if (DEBUG) console.log(`Karma ${amount >= 0 ? "+" : ""}${amount} -> ${wagon.karma}`);
}

// --- Seeded Gambling RNG -------------------------------------------------
function gamblingRandom() {
    if (!wagon) return Math.random();
    if (typeof wagon.gamblingSeed !== "number" || !Number.isFinite(wagon.gamblingSeed)) {
        // One-time initialization for a fresh wagon. After this the seed
        // never touches Date.now() or Math.random() again — it's pure
        // deterministic state from here on out.
        wagon.gamblingSeed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    }
    // mulberry32
    wagon.gamblingSeed = (wagon.gamblingSeed + 0x6D2B79F5) >>> 0;
    let t = wagon.gamblingSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gamblingRandomInt(maxExclusive) {
    return Math.floor(gamblingRandom() * maxExclusive);
}

const Landmarks = {
    // --- SHARED STARTING HUB ---
	"Independence": {
        name: "Independence, Missouri",
        type: "start", num: 1, zone: 1, pos: { x: 952, y: 436 },
        getNext: (route) => {
            if (route === "UNO Reverse") return null;
            return route === "Santa Fe" ? "Council Grove" : "Kansas River Crossing";
        },        
        next: ["Kansas River Crossing", "Council Grove"], 
        distanceToNext: [102, 130],
        description: "The jumping-off point for Oregon, California, and Santa Fe. Missouri: easy to leave, hard to forget."
    },

    // --- SANTA FE TRAIL (Branching early at Independence) ---
    "Council Grove": {
        name: "Council Grove",
        type: "landmark", num: 19, zone: 1, pos: { x: 860, y: 420 },
        next: ["Bent's Old Fort"], distanceToNext: [400],
        description: "Last chance to get hickory wood before the treeless plains. This is the 'Tutorial End' for the Santa Fe."
    },
    "Bent's Old Fort": {
        name: "Bent's Old Fort",
        type: "fort", num: 20, zone: 2, pos: { x: 730, y: 412 },
        next: ["Santa Fe"], distanceToNext: [300],
        description: "An adobe castle in the desert. Trade your junk for some water and hope."
    },
    "Santa Fe": {
        name: "Santa Fe, New Mexico",
        type: "end", num: 21, zone: 4, pos: { x: 617, y: 465 },
        next: [], distanceToNext: [],
        description: "You've reached the end of the Santa Fe Trail! Trade is booming, and the spicy food is definitely better than salted pork."
    },

    // --- SHARED SPINE (Oregon, California, Mormon, Bozeman) ---
    "Kansas River Crossing": {
        name: "Kansas River Crossing",
        type: "river", num: 2, zone: 2, pos: { x: 891, y: 427 },
        getNext: (route) => route === "UNO Reverse" ? "Independence" : "Big Blue River Crossing",
		next: ["Big Blue River Crossing", "Independence"],
        distanceToNext: [82, 102],
		description: "Your first chance to drown."
    },
    "Big Blue River Crossing": {
        name: "Big Blue River Crossing",
        type: "river",
		num: 3, zone: 2, pos: { x: 848, y: 411 },
        getNext: (route) => route === "UNO Reverse" ? "Kansas River Crossing" : "Fort Kearney",
		next: ["Fort Kearney", "Kansas River Crossing"],
        distanceToNext: [118, 82],
		description: "Do you really want to risk danger to head into the fictional lands of Nebraska?"
    },
    "Fort Kearney": {
        name: "Fort Kearney",
        type: "fort",
		num: 4, zone: 2, pos: { x: 810, y: 385 },
        getNext: (route) => route === "UNO Reverse" ? "Big Blue River Crossing" : "Chimney Rock",
		next: ["Chimney Rock", "Big Blue River Crossing"],
        distanceToNext: [250, 118],
		description: "Somehow contain your excitement about being in Nebraska."
    },
    "Chimney Rock": {
        name: "Chimney Rock",
        type: "landmark",
		num: 5, zone: 2, pos: { x: 770, y: 364 },
        getNext: (route) => route === "UNO Reverse" ? "Fort Kearney" : "Fort Laramie",
		next: ["Fort Laramie", "Fort Kearney"],
        distanceToNext: [86, 250],
		description: "What sad life people had before the internet that they got excited by rocks."
    },
	"Fort Laramie": {
        name: "Fort Laramie",
        type: "fort", num: 6, zone: 2, pos: { x: 689, y: 338 },
        getNext: (route) => {
            if (route === "UNO Reverse") return "Chimney Rock";
            return route === "Bozeman" ? "Fort Reno" : "Independence Rock";
        },
        next: ["Independence Rock", "Fort Reno", "Chimney Rock"], 
        distanceToNext: [190, 190, 86],         
        description: "The great supply hub. If you're going to Bozeman, turn right. If you want to live, turn left."
    },

    // --- BOZEMAN TRAIL (Branching at Laramie) ---
    "Fort Reno": {
        name: "Fort Reno",
        type: "fort", num: 22, zone: 3, pos: { x: 666, y: 190 },
        next: ["Fort Phil Kearny"], distanceToNext: [65],
        description: "Deep in hostile territory. The 'Difficulty: Hardcore' label wasn't a joke."
    },
    "Fort Phil Kearny": {
        name: "Fort Phil Kearny",
        type: "fort", num: 23, zone: 3, pos: { x: 565, y: 130 },
        next: ["Virginia City"], distanceToNext: [150],
        description: "Surrounded by a high wooden stockade. They say it's to keep the wildlife out, but it's mostly to keep the fear in."
    },
    "Virginia City": {
        name: "Virginia City, Montana",
        type: "end", num: 24, zone: 5, pos: { x: 616, y: 72 },
        next: [], distanceToNext: [],
        description: "You made it to the Montana gold fields! You're rich! Now you just have to figure out how to spend gold in a town with 80% casualty rates."
    },
    "Independence Rock": {
        name: "Independence Rock",
        type: "landmark", num: 7, zone: 3, 	pos: { x: 625, y: 306 },
        getNext: (route) => route === "UNO Reverse" ? "Fort Laramie" : "South Pass",
		next: ["South Pass", "Fort Laramie"],
        distanceToNext: [102, 190],
		description: "Carve your name on the rock before your name gets carved on a tombstone along the trail."
    },
    "South Pass": {
        name: "South Pass",
        type: "landmark", num: 8, zone: 3, pos: { x: 577, y: 307 },
        getNext: (route) => route === "UNO Reverse" ? "Independence Rock" : null,
		next: ["Green River Crossing", "Fort Bridger", "Independence Rock"],
		distanceToNext: [57, 125, 102],
        description: "The Continental Divide. Take the shortcut or go to the Fort."
    },
    // --- MORMON TRAIL ---
    "Fort Bridger": {
        name: "Fort Bridger",
        type: "fort", num: 10, zone: 3, pos: { x: 460, y: 327 },
        getNext: (route) => route === "Mormon" ? "Salt Lake Valley" : "Soda Springs",
        next: ["Soda Springs", "Salt Lake Valley"],
		distanceToNext: [162, 113],
        description: "Mormon Trail pioneers stop here before descending into the valley."
    },
    "Salt Lake Valley": {
        name: "Salt Lake Valley, Utah",
        type: "end", num: 25, zone: 4, pos: { x: 510, y: 330 },
        next: [], distanceToNext: [],
        description: "This is the place! You've reached the Mormon settlement. Time to build a temple and a Sister Wives reality show."
    },
    "Green River Crossing": {
        name: "Green River Crossing",
        type: "river", 	num: 9, zone: 3, pos: { x: 494, y: 325 },
        getNext: (route) => route === "UNO Reverse" ? "South Pass" : "Soda Springs",
		next: ["Soda Springs", "South Pass"],
        distanceToNext: [143, 57],
		description: "This river is not green. It is not Chicago on St Patrick's Day. But you can still drink beer and act like a fool if you want."
    },
    "Soda Springs": {
        name: "Soda Springs",
        type: "landmark", num: 11, zone: 3, pos: { x: 436, y: 303 },
        getNext: (route) => route === "UNO Reverse" ? "Green River Crossing" : "Fort Hall",
		next: ["Fort Hall", "Green River Crossing"],
        distanceToNext: [57, 143],
		description: "Pristine Soda Springs before the great and terrible Cola Wars of the 1980s."
    },
	"Fort Hall": {
        name: "Fort Hall",
        type: "fort", num: 12, zone: 4, pos: { x: 419, y: 293 },
        getNext: (route) => {
            if (route === "UNO Reverse") return "Soda Springs";
            return route === "California" ? "Humboldt River" : "Snake River Crossing";
        },
        next: ["Snake River Crossing", "Humboldt River", "Soda Springs"], 
        distanceToNext: [182, 195, 57],         
        description: "The point of no return. Oregon or California?"
    },

    // --- CALIFORNIA TRAIL (Branching at Fort Hall) ---
    "Humboldt River": {
        name: "Humboldt River",
        type: "river", num: 26, zone: 4, pos: { x: 266, y: 303 },
        next: ["Donner Pass"], distanceToNext: [300],
        description: "Follow the river through the desert. It's hot, it's dry, and the water tastes like a dirty sock."
    },
    "Donner Pass": {
        name: "Donner Pass",
        type: "landmark", num: 27, zone: 5, pos: { x: 175, y: 344 },
        next: ["Sutter's Fort"], distanceToNext: [100],
        description: "The Sierra Nevada. If it starts snowing, maybe don't look at your family members as 'Edible Assets'."
    },
    "Sutter's Fort": {
        name: "Sutter's Fort, California",
        type: "end", num: 28, zone: 5, pos: { x: 131, y: 350 },
        next: [], distanceToNext: [],
        description: "California! You've arrived at Sutter's Fort. There's gold in these hills, and hopefully, no more cannibalism."
    },
    "Snake River Crossing": {
        name: "Snake River Crossing",
        type: "river",
		num: 13, zone: 4, pos: { x: 336, y: 294 },
		getNext: (route) => route === "UNO Reverse" ? "Fort Hall" : "Fort Boise",
		next: ["Fort Boise", "Fort Hall"],
        distanceToNext: [114, 182],
		description: "If you haven't yet drown your kids with a disasterous river crossing, now may be the time."
    },
    "Fort Boise": {
        name: "Fort Boise",
        type: "fort", num: 14, zone: 4, pos: { x: 298, y: 257 },
		getNext: (route) => route === "UNO Reverse" ? "Snake River Crossing" : "Blue Mountains",
		next: ["Blue Mountains", "Snake River Crossing"],
        distanceToNext: [160, 114],
		description: "This just became part of the US two years ago after the northern boundary dispute."
    },
    "Blue Mountains": {
        name: "Blue Mountains",
        type: "landmark", num: 15, zone: 5, pos: { x: 246, y: 186 },
        getNext: (route) => route === "UNO Reverse" ? "Fort Boise" : null,
        next: ["Fort Walla Walla", "The Dalles", "Fort Boise"],
        distanceToNext: [55, 125, 160], // Branching paths
		description: "Do you want the easy way out, or do you want to risk a shortcut?"
    },
    "Fort Walla Walla": {
        name: "Fort Walla Walla",
        type: "fort", num: 16, zone: 5, pos: { x: 220, y: 159 },
        next: ["The Dalles"],
        distanceToNext: [120],
		description: "Is this a historical inaccuracy in the game? I didn't think the fort was established until 1856."
    },
	"The Dalles": {
        name: "The Dalles",
        type: "landmark",
        num: 17, zone: 5, pos: { x: 173, y: 165 },
        // Use standard function syntax to avoid syntax errors
        getNext: (route) => route === "UNO Reverse" ? "Blue Mountains" : "Willamette Valley",
        next: ["Willamette Valley", "Blue Mountains"],
        distanceToNext: [100, 125],
        description: "Dalles means Flagstone in French. This is your final choice."
    },
    "Willamette Valley": {
        name: "Willamette Valley, Oregon",
        type: "end", num: 18, zone: 5, pos: { x: 92, y: 198 },
        // If we are on UNO Reverse, The Dalles is the 'next' step, not null
        getNext: (route) => route === "UNO Reverse" ? "The Dalles" : null,
        next: ["The Dalles"],
        distanceToNext: [100],
        description: "Somehow you made it!"
    },

    // --- RANDOM TRAIL (These only appear randomy in the Random Route) ---
	"Wonka's Chocolate River": {
        name: "Wonka's Chocolate River",
        type: "river", num: 29, zone: 2, pos: { x: 500, y: 250 },
        next: [], distanceToNext: [],
        description: "The river is 100% pure liquid chocolate. Causing your family members to drown here is technically a health code violation, but it tastes magnificent."
    },
    "The Blanket Fort": {
        name: "The Blanket Fort",
        type: "fort", num: 30, zone: 1, pos: { x: 450, y: 200 },
        next: [], distanceToNext: [],
        description: "A sovereign nation constructed entirely out of couch cushions and duvet covers. The local economy runs on loose pocket change and stolen juice boxes."
    },
    "The Uncanny Valley": {
        name: "The Uncanny Valley",
        type: "river", num: 31, zone: 4, pos: { x: 300, y: 300 },
        next: [], distanceToNext: [],
        description: "The scenery here looks slightly human but completely wrong. The water is made of unrendered textures and your party feels intensely uncomfortable."
    },
    "The Infinite Loop": {
        name: "The Infinite Loop",
        type: "landmark", num: 32, zone: 3, pos: { x: 888, y: 88 },
        next: [], distanceToNext: [],
        description: "A strange landmark where you swear you've seen this exact description before. A strange landmark where you swear you've seen this exact description before."
    },
    "The Abandoned Server Room": {
        name: "The Abandoned Server Room",
        type: "landmark", num: 33, zone: 5, pos: { x: 69, y: 69 },
        next: [], distanceToNext: [],
        description: "A dusty, air-conditioned vault full of blinking green lights. You can hear the distant hum of a cooling fan trying to prevent a fatal runtime overflow."
    },
    "Area 51": {
        name: "Area 51",
        type: "fort", num: 34, zone: 4, pos: { x: 215, y: 395 },
        next: [], distanceToNext: [],
        description: "We can neither confirm nor deny this landmark exists. How long have the aliens been here? Do they know Bigfoot?"
    },
    "The Backrooms": {
        name: "The Backrooms",
        type: "landmark", num: 35, zone: 5, pos: { x: 420, y: 420 },
        next: [], distanceToNext: [],
        description: "A seemingly infinite, extradimensional maze of empty rooms. Did you use a noclip cheat on this game?"
    },
};

const LANDMARK_BY_NUM = {};
for (const key in Landmarks) {
    LANDMARK_BY_NUM[Landmarks[key].num] = Landmarks[key];
}

const FortMultipliers = {
    "Independence": 1.0,
    "Fort Kearney": 1.10,
    "Fort Laramie": 1.25,
    "Bent's Old Fort": 1.35,  // Santa Fe Path
    "Fort Bridger": 1.45,
    "Fort Reno": 1.65,        // Bozeman Path
    "Fort Hall": 1.75,
    "Fort Boise": 2.15,
    "Fort Phil Kearny": 2.35, // Bozeman Path
    "Fort Walla Walla": 2.65,
	"The Blanket Fort": 2.75,
	"Area 51": 2.85,
};

const STEALABLE_ITEMS = [
    { key: "medicine", label: "a bottle of medicine",         weight: 1,  wagonAmount: 1,  field: "medicine" },
    { key: "bullets",  label: "a box of bullets (20 rounds)", weight: 1,  wagonAmount: 20, field: "bullets" },
    { key: "books",    label: "a book",                       weight: 3,  wagonAmount: 1,  field: "books" },
    { key: "clothing", label: "a set of clothing",            weight: 5,  wagonAmount: 1,  field: "clothing" },
    { key: "firewood", label: "a bundle of firewood",         weight: 15, wagonAmount: 1,  field: "firewood" },
    { key: "food",     label: "a sack of food (15 lbs)",      weight: 15, wagonAmount: 15, field: "food" },
    { key: "wheels",   label: "a spare wagon wheel",          weight: 40, wagonAmount: 1,  field: "wheels" },
];

const DRAFT_ANIMALS = {
    "Oxen": {
        singular: "ox", plural: "oxen", Singular: "Ox", Plural: "Oxen",
        unitCost: 25,
        pullPerAnimal: 500,       // strongest haulers — the classic 500 lbs/head
        paceModifier: 1.0,        // baseline pace
        theftChance: 0,           // outlaws take one look and lose interest
        stubbornChance: 0,
        lowWaterHealthMult: 1.0,  // no special desert resilience
        previewImg: "img/ox.png",
        spriteFile: "oxen_animated.gif",
        hoverText: "An ox named oxen, which is on the nose.",
        blurb: "Oxen (~$25/head) — cheapest, strongest, and toughest. Thieves leave them alone."
    },
    "Mules": {
        singular: "mule", plural: "mules", Singular: "Mule", Plural: "Mules",
        unitCost: 30,
        pullPerAnimal: 400,       // less than oxen, more than horses
        paceModifier: 1.15,       // faster than oxen
        theftChance: 0.15,        // lower risk than horses
        stubbornChance: 0.08,     // per-day chance they simply refuse to move (see Wagon.turn)
        lowWaterHealthMult: 0.5,  // handle low water/desert crossings well
        previewImg: "img/mule.png",
        spriteFile: "mule_animated.gif",
        hoverText: "A mule named oxen for some strange reason.",
        blurb: "Mules (~$30/head) — faster than oxen, handle the desert well, but stubborn."
    },
    "Horses": {
        singular: "horse", plural: "horses", Singular: "Horse", Plural: "Horses",
        unitCost: 40,
        pullPerAnimal: 300,       // fastest, but can't haul like oxen
        paceModifier: 1.3,        // fastest pace of the three
        theftChance: 0.45,        // outlaw bait
        stubbornChance: 0,
        lowWaterHealthMult: 1.0,
        previewImg: "img/horse.png",
        spriteFile: "horse_animated.gif",
        hoverText: "A horse named oxen for some strange reason.",
        blurb: "Horses (~$40/head) — fastest pace, but can't pull as much and attract outlaws."
    },
    "Mechanical Bull": {
        singular: "mechanical bull", plural: "mechanical bulls", Singular: "Mechanical Bull", Plural: "Mechanical Bulls",
        unitCost: 100,
        pullPerAnimal: 0,
        paceModifier: 1.0,
        theftChance: 0,
        stubbornChance: 0,
        lowWaterHealthMult: 1.0,
        previewImg: "img/bull.png",
        spriteFile: "bull_animated.gif",
        hoverText: "A mechanical bull named oxen. Nobody has explained why.",
        blurb: "Mechanical Bull (~$100/head) — rides like a dream, pulls like a nightmare."
    }
};

function getDraftAnimalConfig(key) {
    return DRAFT_ANIMALS[key] || DRAFT_ANIMALS["Oxen"];
}

const Zones = {
    1: { name: "The Great Plains (East)", terrain: "prairie", baseTemp: 55, grassChance: 0.90, precipProb: 0.28, weatherRisk: "rain" },
    2: { name: "The Great Plains (West)", terrain: "plains", baseTemp: 56, grassChance: 0.85, precipProb: 0.22, weatherRisk: "thunderstorm" },
    3: { name: "The Rocky Mountains", terrain: "rocky", baseTemp: 42, grassChance: 0.60, precipProb: 0.14, weatherRisk: "snow" },
    4: { name: "The Great Basin", terrain: "desert", baseTemp: 52, grassChance: 0.40, precipProb: 0.07, weatherRisk: "heat" },
    5: { name: "The Blue Mountains", terrain: "mountain", baseTemp: 48, grassChance: 0.70, precipProb: 0.10, weatherRisk: "snow" }
};

const ZONE_NATIONS = {
    1: "Lakota",
    2: "Comanche",
    3: "Blackfeet",
    4: "Shoshone",
    5: "Cayuse",
};

const GATHER_RESOURCE_INFO = {
    "Block of Wood":        { stageName: "Punching Trees",   clicksBase: 10, yieldMin: 2, yieldMax: 5 },
    "Square Cow":           { stageName: "Punching Cows",    clicksBase: 15, yieldMin: 1, yieldMax: 2 },
    "Medicinal Plants":     { stageName: "Uprooting Plants", clicksBase: 12, yieldMin: 3, yieldMax: 6 },
    "Glitched Cobblestone": { stageName: "Mining Pixels",    clicksBase: 10, yieldMin: 2, yieldMax: 4 },
};

const ZONE_GATHER_PROFILE = {
    1: { order: ["Block of Wood", "Medicinal Plants", "Square Cow", "Glitched Cobblestone"], yieldMult: 1.1,
         intro: "Lush prairie grass — plenty of timber and herbs close at hand." },
    2: { order: ["Square Cow", "Block of Wood", "Medicinal Plants", "Glitched Cobblestone"], yieldMult: 1.1,
         intro: "Open grazing land — the local wildlife notices you first." },
    3: { order: ["Glitched Cobblestone", "Block of Wood", "Medicinal Plants", "Square Cow"], yieldMult: 1.0,
         intro: "Rocky terrain — stone is everywhere, everything else takes work." },
    4: { order: ["Medicinal Plants", "Glitched Cobblestone", "Block of Wood", "Square Cow"], yieldMult: 0.8,
         intro: "Sparse desert scrub — hardy plants survive here; not much else does." },
    5: { order: ["Block of Wood", "Glitched Cobblestone", "Medicinal Plants", "Square Cow"], yieldMult: 1.0,
         intro: "Dense mountain conifer — timber and stone both close by." },
};

const sounds = {
	2001: './sounds/2001.mp3',
	achievement: './sounds/achievement.mp3',
    alert: './sounds/alert.mp3',
    amen: './sounds/amen.mp3',
	axel: './sounds/axel.mp3',
    bigfoot: './sounds/bigfoot.mp3',
	chevy: './sounds/chevy.mp3',
	circus: './sounds/circus.mp3',
    criticalhit: './sounds/criticalhit.mp3',
    crt: './sounds/crt.mp3',
    dryfire: './sounds/dryfire.mp3',
	gameover: './sounds/gameover.mp3',
	gold: './sounds/gold.mp3',
	hard: './sounds/hard.mp3',
    horse: './sounds/horse.mp3',
    I_do: './sounds/I_do.mp3',
	ironman: './sounds/ironman.mp3',
    jesusWheel: './sounds/jesusWheel.mp3',
	key: './sounds/key.mp3',
	Konami: './sounds/Konami.mp3',
	lootbox: './sounds/lootbox.mp3',
    mario: './sounds/mario.mp3',
    meat: './sounds/meat.mp3',
	miss: './sounds/miss.mp3',
	monster: './sounds/monster.mp3',
    pistol: './sounds/pistol.mp3',
    rifle: './sounds/rifle.mp3',
	river: './sounds/river.mp3',
	rivercrossing: './sounds/rivercrossing.mp3',
	rock: './sounds/rock.mp3',
	rude: './sounds/rude.mp3',
    sad: './sounds/sad.mp3',
	shiny: './sounds/shiny.mp3',
    shotgun: './sounds/shotgun.mp3',
    snow: './sounds/snow.mp3',
	spooky: './sounds/spooky.mp3',
    tar: './sounds/tar.mp3',
	thunder: './sounds/thunder.mp3',
    takethetrade: './sounds/takethetrade.mp3',
	telegraph: './sounds/telegraph.mp3',
	trade: './sounds/trade.mp3',
	whimper: './sounds/whimper.mp3',
	wind: './sounds/wind.mp3',
	woof: './sounds/woof.mp3',
	yummy: './sounds/yummy.mp3',
};

const AudioManager = {
    bgm: new Audio(),
    isMuted: false,
    currentZoneTrack: null, 
    _sfxPools: {},

    getTrackPath: function(basePath) {
        if (!isNostalgia || !basePath) return basePath;
        return basePath.replace('.mp3', '-classic.mp3');
    },

    toggleMute: function() {
        this.isMuted = !this.isMuted;
        if (wagon) wagon.isMuted = this.isMuted; // Sync to wagon state
        this.bgm.muted = this.isMuted;
        document.getElementById("mute-button").textContent = this.isMuted ? "Unmute" : "Mute";
        saveGame(); // Save immediately when toggled
    },

    playZoneBGM: function(zoneId) {
        this.currentZoneTrack = `./sounds/bgm-${zoneId}.mp3`;
        this.bgm.pause();
        this.bgm.src = this.getTrackPath(this.currentZoneTrack);
        this.bgm.loop = true;
		this.bgm.volume = 0.3;
        this.bgm.play().catch(e => console.log("BGM blocked"));
    },

    playHuntBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-hunting.mp3');
        this.bgm.loop = true;
        this.bgm.play();
    },

    playFishingBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-fishing.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Fishing BGM blocked"));
    },
	
    playGatheringBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-gathering.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Gathering BGM blocked"));
    },

    playProspectingBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-prospecting.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Prospecting BGM blocked"));
    },

    playTradingBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-trading.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Trading BGM blocked"));
    },
	
    playRaftingBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-rafting.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Rafting BGM blocked"));
    },
	
    playShovelingBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-shoveling.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Shoveling BGM blocked"));
    },

    playMormonBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-mormon.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Mormon BGM blocked"));
    },
	
    playSantaFeBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-santafe.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Santa Fe BGM blocked"));
    },

    playBozemanBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-bozeman.mp3');
        this.bgm.loop = true;
        this.bgm.play().catch(e => console.log("Bozeman BGM blocked"));
    },
	
    playVictoryBGM: function() {
        this.bgm.pause();
        this.bgm.src = this.getTrackPath('./sounds/bgm-victory.mp3');
        this.bgm.loop = true; // Or false if you want it to play once
        this.bgm.play().catch(e => console.log("Victory BGM blocked"));
    },

    returnToPreviousBGM: function() {
        this.bgm.pause();
        if (this.currentZoneTrack) {
            this.bgm.src = this.getTrackPath(this.currentZoneTrack);
            this.bgm.play();
        }
    },

    refreshBGM: function() {
        const currentPos = this.bgm.currentTime;
        const isPaused = this.bgm.paused;
        
        this.bgm.src = this.getTrackPath(this.bgm.src.replace('-classic', ''));
        
        if (!isPaused) {
            this.bgm.play().then(() => {
                this.bgm.currentTime = currentPos;
            });
        }
    },

    playSound: function(effectName) {
        if (this.isMuted) return; 
        const soundFile = sounds[effectName];
        if (!soundFile) return;

        let pool = this._sfxPools[effectName];
        if (!pool) {
            pool = { elements: [new Audio(soundFile), new Audio(soundFile), new Audio(soundFile)], next: 0 };
            this._sfxPools[effectName] = pool;
        }

        const sfx = pool.elements[pool.next];
        pool.next = (pool.next + 1) % pool.elements.length;

        sfx.currentTime = 0;
        sfx.play().catch(() => {}); // suppress unhandled-rejection noise from autoplay-blocking browsers
    },
};

const ANIMALS = [
    { name: "Badger", minMeat: 4, maxMeat: 20, hp: 25, difficulty: 3, zone1: true, zone2: true, zone3: true, zone4: true, zone5: true, prefRange: "close" },
	{ name: "Beaver", minMeat: 25, maxMeat: 50, hp: 20, difficulty: 2, zone1: true, zone2: true, zone3: true, zone4: false, zone5: true, prefRange: "close" },
    { name: "Bighorn Sheep", minMeat: 50, maxMeat: 250, hp: 75, difficulty: 3, zone1: false, zone2: false, zone3: true, zone4: true, zone5: true, prefRange: "close", large: true },
    { name: "Bison", minMeat: 350, maxMeat: 500, hp: 150, difficulty: 5, zone1: true, zone2: true, zone3: false, zone4: true, zone5: false, prefRange: "long", large: true },
	{ name: "Black Bear", minMeat: 100, maxMeat: 300, hp: 100, difficulty: 4, zone1: false, zone2: false, zone3: false, zone4: true, zone5: true, prefRange: "long", large: true },
	{ name: "Brown Bear", minMeat: 250, maxMeat: 500, hp: 150, difficulty: 5, zone1: false, zone2: false, zone3: true, zone4: true, zone5: true, prefRange: "long", large: true },
	{ name: "Cougar", minMeat: 60, maxMeat: 120, hp: 50, difficulty: 3, zone1: false, zone2: false, zone3: false, zone4: true, zone5: true, prefRange: "long" },
	{ name: "Coyote", minMeat: 10, maxMeat: 35, hp: 10, difficulty: 2, zone1: false, zone2: true, zone3: false, zone4: true, zone5: false, prefRange: "close" },
    { name: "Deer", minMeat: 45, maxMeat: 125, hp: 45, difficulty: 2, zone1: true, zone2: true, zone3: false, zone4: false, zone5: false, prefRange: "close" },
	{ name: "Duck", minMeat: 1, maxMeat: 2, hp: 2, difficulty: 1, zone1: true, zone2: true, zone3: false, zone4: false, zone5: true, prefRange: "close"  },
	{ name: "Elk", minMeat: 350, maxMeat: 500, hp: 150, difficulty: 4, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "long", large: true },
	{ name: "Fox", minMeat: 1, maxMeat: 7, hp: 5, difficulty: 2, zone1: true, zone2: true, zone3: false, zone4: false, zone5: false, prefRange: "close" },
	{ name: "Lynx", minMeat: 15, maxMeat: 40, hp: 15, difficulty: 2, zone1: false, zone2: false, zone3: true, zone4: false, zone5: false, prefRange: "close" },
	{ name: "Moose", minMeat: 350, maxMeat: 750, hp: 150, difficulty: 5, zone1: true, zone2: false, zone3: true, zone4: false, zone5: false, prefRange: "long", large: true },
	{ name: "Mountain Goat", minMeat: 50, maxMeat: 200, hp: 65, difficulty: 3, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "long" },
	{ name: "Prairie Dog", minMeat: 1, maxMeat: 3, hp: 1, difficulty: 2, zone1: false, zone2: false, zone3: true, zone4: true, zone5: true, prefRange: "close" },
	{ name: "Pronghorn", minMeat: 50, maxMeat: 100, hp: 30, difficulty: 3, zone1: false, zone2: true, zone3: true, zone4: false, zone5: false, prefRange: "long" },
	{ name: "Rabbit", minMeat: 1, maxMeat: 4, hp: 3, difficulty: 2, zone1: true, zone2: true, zone3: false, zone4: true, zone5: false, prefRange: "close" },
	{ name: "Skunk", minMeat: 2, maxMeat: 10, hp: 5, difficulty: 1, zone1: true, zone2: true, zone3: true, zone4: true, zone5: true, prefRange: "close" },
	{ name: "Squirrel", minMeat: 1, maxMeat: 4, hp: 3, difficulty: 1, zone1: true, zone2: true, zone3: true, zone4: true, zone5: true, prefRange: "close" },
	{ name: "Turkey", minMeat: 5, maxMeat: 20, hp: 5, difficulty: 1, zone1: true, zone2: true, zone3: true, zone4: false, zone5: true, prefRange: "close" },
	{ name: "Muskrat", minMeat: 8, maxMeat: 20, hp: 8, difficulty: 1, zone1: true, zone2: true, zone3: false, zone4: false, zone5: false, prefRange: "close" },
	{ name: "Raccoon", minMeat: 10, maxMeat: 25, hp: 15, difficulty: 2, zone1: true, zone2: true, zone3: false, zone4: false, zone5: false, prefRange: "close" },
	{ name: "Canada Goose", minMeat: 4, maxMeat: 10, hp: 4, difficulty: 1, zone1: true, zone2: true, zone3: false, zone4: false, zone5: false, prefRange: "long" },
	{ name: "Sandhill Crane", minMeat: 5, maxMeat: 15, hp: 6, difficulty: 2, zone1: true, zone2: true, zone3: false, zone4: true, zone5: false, prefRange: "long" },
	{ name: "Bobcat", minMeat: 20, maxMeat: 45, hp: 25, difficulty: 3, zone1: false, zone2: true, zone3: true, zone4: true, zone5: true, prefRange: "close" },
	{ name: "Snowshoe Hare", minMeat: 2, maxMeat: 6, hp: 3, difficulty: 1, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "close" },
	{ name: "Marmot", minMeat: 5, maxMeat: 15, hp: 10, difficulty: 1, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "close" },
	{ name: "Porcupine", minMeat: 8, maxMeat: 20, hp: 12, difficulty: 1, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "close" },
	{ name: "Jackrabbit", minMeat: 2, maxMeat: 6, hp: 4, difficulty: 2, zone1: false, zone2: true, zone3: false, zone4: true, zone5: false, prefRange: "close" },
	{ name: "Sage Grouse", minMeat: 3, maxMeat: 8, hp: 4, difficulty: 1, zone1: false, zone2: false, zone3: false, zone4: true, zone5: false, prefRange: "long" },
	{ name: "Kit Fox", minMeat: 2, maxMeat: 8, hp: 6, difficulty: 2, zone1: false, zone2: false, zone3: false, zone4: true, zone5: false, prefRange: "close" },
	{ name: "Blue Grouse", minMeat: 3, maxMeat: 8, hp: 4, difficulty: 1, zone1: false, zone2: false, zone3: true, zone4: false, zone5: true, prefRange: "long" },
	{ name: "Jimothy the Raccoon", minMeat: 0, maxMeat: 0, hp: 1, difficulty: -1, zone1: false, zone2: false, zone3: false, zone4: true, zone5: false, prefRange: "close" },
	{ name: "Harambe the Gorilla", minMeat: 0, maxMeat: 0, hp: 1, difficulty: -1, zone1: false, zone2: false, zone3: false, zone4: false, zone5: true, prefRange: "close", large: true },
];

const ANIMAL_EMOJIS = {
    "Badger": "🦡",
	"Beaver": "🦫",
	"Bigfoot": "🫈",
	"Bighorn Sheep": "🐏",
	"Bison": "🐃",
	"Black Bear": "🐻",
	"Brown Bear": "🐻",
	"Cougar": "🐆",
	"Coyote": "🐺",
	"Deer": "🦌",
	"Duck": "🦆",
	"Elk": "🦌",
	"Fox": "🦊",
	"Lynx": "🐆",
	"Moose": "🐂",
	"Mountain Goat": "🐐",
	"Prairie Dog": "🦔",
	"Pronghorn": "🦌",
	"Rabbit": "🐇",
	"Skunk": "🦨",
	"Squirrel": "🐿️",
	"Turkey": "🦃",
	"Muskrat": "🐀",
	"Raccoon": "🦝",
	"Canada Goose": "🪿",
	"Sandhill Crane": "🦩",
	"Bobcat": "🐆",
	"Snowshoe Hare": "🐇",
	"Marmot": "🐿️",
	"Porcupine": "🦔",
	"Jackrabbit": "🐇",
	"Sage Grouse": "🐓",
	"Kit Fox": "🦊",
	"Blue Grouse": "🐓",
	"Jimothy the Raccoon": "🦝",
	"Harambe the Gorilla": "🦍",
};

const BIGFOOT = { 
    name: "Bigfoot", 
    emoji: "🫈", 
    minMeat: 500, 
    maxMeat: 500, 
    hp: 205, 
    difficulty: 6, 
    prefRange: "close" 
};

const WEAPONS = {
    "Pistol":  { damage: 30, closeAccuracy: 80, longAccuracy: 35, ammoCost: 1, reloadTurns: 0 },
    "Shotgun": { damage: 70, closeAccuracy: 75, longAccuracy: 10, ammoCost: 3, reloadTurns: 1 },
    "Rifle":   { damage: 50, closeAccuracy: 50, longAccuracy: 85, ammoCost: 2, reloadTurns: 1 }
};

function pickWeightedAnimal(available, isTracker) {
    if (available.length === 0) return null;
    const weighted = available.map(a => ({
        animal: a,
        // Large game is scarce by default; Tracking flips the odds toward it
        // instead of just nudging them.
        weight: a.large ? (isTracker ? 1.6 : 0.35) : 1.0,
    }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const w of weighted) {
        roll -= w.weight;
        if (roll <= 0) return w.animal;
    }
    return weighted[weighted.length - 1].animal; // float rounding fallback
}

function baseTurnsForAnimal(animal) {
    if (animal.name === "Bigfoot") return 6;
    if (animal.difficulty >= 4) return 6;
    if (animal.difficulty === 3) return 4;
    if (animal.difficulty === 2) return 3;
    return 2;
}

function generateHuntOptions() {
    const isTracker = hasSkill("Tracking");
    let trailChance = isTracker ? 1.0 : 0.55; // was 0.7 — cold trails now bite without Tracking

    if (!isTracker) {
        if (wagon.isSnowing) trailChance += 0.10;
        if (wagon.hasWater && !wagon.isSnowing) trailChance -= 0.10;
        trailChance = Math.max(0.15, Math.min(1.0, trailChance));
    }

    let bigfootChance = 0.01;
    if (hasSkill("Animal Handling")) bigfootChance += 0.005;
    if (isTracker) bigfootChance += 0.025; // Tracking is the real Bigfoot-hunting skill
    if (DEBUG) console.log("Bigfoot chance:", bigfootChance);

    if (Math.random() < bigfootChance) {
        return [BIGFOOT, BIGFOOT, BIGFOOT]; // Force the player to pick the trail
    }

    const available = wagon.getAvailableAnimals();
    const options = [];
    for (let i = 0; i < 3; i++) {
        options.push(Math.random() < trailChance ? pickWeightedAnimal(available, isTracker) : null);
    }
    return options;
}

const FISH = [
    // --- ZONE 1: MISSOURI / EASTERN PLAINS ---
    { name: "Like a Sturgeon", type: "Worm-mander", baseWeight: 45, rarity: "rare", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Peter Quillback", type: "Worm-mander", baseWeight: 3, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Bigmouth Buffalo Bills", type: "Worm-mander", baseWeight: 20, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Shadow the Hedgehog Bass", type: "Bait-asaur", baseWeight: 1, rarity: "common", zone1: true, zone2: false, zone3: false, zone4: false, zone5: false },
    { name: "Frequent Flier", type: "Squirt-le-Lure", baseWeight: 0.5, rarity: "common", zone1: true, zone2: false, zone3: false, zone4: false, zone5: false },
    { name: "Prodigal Sunfish", type: "Worm-mander", baseWeight: 1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: false, zone5: true },
    { name: "Holy Carpsucker", type: "Bait-asaur", baseWeight: 4, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Grass-type Carp", type: "Squirt-le-Lure", baseWeight: 15, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Red Herring", type: "Bait-asaur", baseWeight: 0.5, rarity: "common", zone1: true, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Hornyhead-on-Main Chub", type: "Squirt-le-Lure", baseWeight: 0.2, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },

    // --- ZONE 2: WESTERN PLAINS / PLATTE RIVER ---
    { name: "Not-so-Freshwater Drum", type: "Worm-mander", baseWeight: 10, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Elon Muskellunge", type: "Worm-mander", baseWeight: 30, rarity: "epic", zone1: true, zone2: true, zone3: false, zone4: false, zone5: true },
    { name: "Chinny-chin-chinook Salmon", type: "Bait-asaur", baseWeight: 35, rarity: "rare", zone1: false, zone2: true, zone3: false, zone4: true, zone5: true },
    { name: "Philips and Flathead Catfish", type: "Squirt-le-Lure", baseWeight: 40, rarity: "rare", zone1: true, zone2: true, zone3: false, zone4: true, zone5: false },
    { name: "Redfin Guitar Pickerel", type: "Worm-mander", baseWeight: 1, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "As Good as Goldeye", type: "Bait-asaur", baseWeight: 2, rarity: "uncommon", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Without a Paddlefish", type: "Bait-asaur", baseWeight: 60, rarity: "epic", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "No Fluke", type: "Squirt-le-Lure", baseWeight: 3, rarity: "uncommon", zone1: false, zone2: true, zone3: false, zone4: false, zone5: true },
    { name: "Let Minnow", type: "Bait-asaur", baseWeight: 0.1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: true, zone5: true },
    { name: "Jump and a Skipjack Herring", type: "Worm-mander", baseWeight: 2, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },

    // --- ZONE 3: ROCKY MOUNTAINS ---
    { name: "Taste the Rainbow Trout", type: "Squirt-le-Lure", baseWeight: 5, rarity: "common", zone1: false, zone2: true, zone3: true, zone4: true, zone5: true },
    { name: "Artic Char-broiled", type: "Worm-mander", baseWeight: 8, rarity: "rare", zone1: false, zone2: false, zone3: true, zone4: false, zone5: true },
    { name: "Mellow Yellow Perch", type: "Worm-mander", baseWeight: 1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Balls-to-the-Walleye", type: "Bait-asaur", baseWeight: 12, rarity: "uncommon", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Smashing Pumpkinseed", type: "Bait-asaur", baseWeight: 0.5, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Spottail Shiner Bock", type: "Squirt-le-Lure", baseWeight: 0.1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Northern Turn-Pike", type: "Bait-asaur", baseWeight: 20, rarity: "rare", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Bubble Guppy", type: "Worm-mander", baseWeight: 0.1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: true, zone5: true },
    { name: "Double-Edged Swordtail", type: "Squirt-le-Lure", baseWeight: 0.2, rarity: "uncommon", zone1: false, zone2: false, zone3: true, zone4: true, zone5: false },
    { name: "Black and Bluegill", type: "Bait-asaur", baseWeight: 1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: true, zone5: true },

    // --- ZONE 4: DESERT / SNAKE RIVER ---
    { name: "Channel Copy-Catfish", type: "Worm-mander", baseWeight: 15, rarity: "uncommon", zone1: true, zone2: true, zone3: true, zone4: true, zone5: true },
    { name: "Brown Raging Bullhead", type: "Squirt-le-Lure", baseWeight: 2, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: true, zone5: false },
    { name: "Bareback Trout", type: "Bait-asaur", baseWeight: 3, rarity: "uncommon", zone1: false, zone2: false, zone3: true, zone4: true, zone5: false },
    { name: "White-Knight-Fish", type: "Worm-mander", baseWeight: 2, rarity: "common", zone1: false, zone2: false, zone3: true, zone4: true, zone5: true },
    { name: "Shoes and Sockeye Salmon", type: "Squirt-le-Lure", baseWeight: 10, rarity: "rare", zone1: false, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Cutthroat Tactics Trout", type: "Squirt-le-Lure", baseWeight: 4, rarity: "uncommon", zone1: false, zone2: false, zone3: true, zone4: true, zone5: true },
    { name: "Brrrr-bot", type: "Worm-mander", baseWeight: 6, rarity: "uncommon", zone1: true, zone2: false, zone3: true, zone4: true, zone5: true },
    { name: "Quick-Sand Roller", type: "Bait-asaur", baseWeight: 0.3, rarity: "common", zone1: false, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Redbelly Untilapia", type: "Bait-asaur", baseWeight: 3, rarity: "uncommon", zone1: false, zone2: false, zone3: false, zone4: true, zone5: false },
    { name: "Bowl and Platy", type: "Squirt-le-Lure", baseWeight: 0.2, rarity: "common", zone1: false, zone2: false, zone3: false, zone4: true, zone5: false },

    // --- ZONE 5: BLUE MOUNTAINS / PACIFIC COAST ---
    { name: "Tickled Pink Salmon", type: "Worm-mander", baseWeight: 6, rarity: "common", zone1: false, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Pacific Oh My Cod", type: "Squirt-le-Lure", baseWeight: 25, rarity: "uncommon", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
    { name: "Detroit Tiger Muskie", type: "Worm-mander", baseWeight: 20, rarity: "rare", zone1: false, zone2: false, zone3: true, zone4: true, zone5: true },
    { name: "Albacore Values Tuna", type: "Bait-asaur", baseWeight: 40, rarity: "rare", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
    { name: "Man of Steelhead", type: "Worm-mander", baseWeight: 12, rarity: "uncommon", zone1: false, zone2: false, zone3: true, zone4: true, zone5: true },
    { name: "Brook Shields Trout", type: "Bait-asaur", baseWeight: 2, rarity: "common", zone1: true, zone2: false, zone3: true, zone4: false, zone5: true },
    { name: "Magnetic Stripe Bass", type: "Squirt-le-Lure", baseWeight: 30, rarity: "rare", zone1: true, zone2: false, zone3: false, zone4: false, zone5: true },
    { name: "Tiger Muskie Scent", type: "Bait-asaur", baseWeight: 15, rarity: "uncommon", zone1: false, zone2: false, zone3: true, zone4: false, zone5: true },
    { name: "Mary Anchovy", type: "Squirt-le-Lure", baseWeight: 0.1, rarity: "common", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
    { name: "Pacific For the Halibut", type: "Squirt-le-Lure", baseWeight: 100, rarity: "epic", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },

    // --- Random extras - may expand more later ---
    { name: "Bass-Ackwards", type: "Worm-mander", baseWeight: 3, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Carp-e Diem", type: "Bait-asaur", baseWeight: 5, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: false, zone5: false },
    { name: "Cat-Astrophe Fish", type: "Squirt-le-Lure", baseWeight: 12, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Crappie Design", type: "Squirt-le-Lure", baseWeight: 2, rarity: "common", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Gill-ty Conscience", type: "Worm-mander", baseWeight: 1, rarity: "common", zone1: true, zone2: true, zone3: true, zone4: true, zone5: true },
    { name: "Holy Mackerel", type: "Worm-mander", baseWeight: 4, rarity: "rare", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
    { name: "Lo-Fi Perch", type: "Bait-asaur", baseWeight: 2, rarity: "common", zone1: true, zone2: false, zone3: false, zone4: false, zone5: false },
    { name: "Muskellunge-evity", type: "Bait-asaur", baseWeight: 25, rarity: "rare", zone1: true, zone2: false, zone3: false, zone4: false, zone5: false },
    { name: "Pike-o-Meter", type: "Worm-mander", baseWeight: 8, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
    { name: "Salmon-ella", type: "Bait-asaur", baseWeight: 15, rarity: "uncommon", zone1: false, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Sturgeon-General", type: "Worm-mander", baseWeight: 50, rarity: "epic", zone1: false, zone2: false, zone3: false, zone4: true, zone5: true },
    { name: "Trout-fit of the Day", type: "Squirt-le-Lure", baseWeight: 4, rarity: "common", zone1: false, zone2: false, zone3: true, zone4: false, zone5: true },
    { name: "Walleye of Sauron", type: "Squirt-le-Lure", baseWeight: 6, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
	{ name: "Squid Pro Quo", type: "Squirt-le-Lure", baseWeight: 50, rarity: "rare", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
	{ name: "Pit Bull Shark", type: "Bait-asaur", baseWeight: 100, rarity: "epic", zone1: false, zone2: false, zone3: false, zone4: false, zone5: true },
	{ name: "Frying Nemo", type: "Worm-mander", baseWeight: 1, rarity: "uncommon", zone1: true, zone2: false, zone3: false, zone4: false, zone5: false },
	{ name: "O-fish-ally Gill-ty", type: "Bait-asaur", baseWeight: 10, rarity: "uncommon", zone1: true, zone2: true, zone3: false, zone4: false, zone5: false },
	{ name: "Nigerian Prince", type: "Squirt-le-Lure", baseWeight: 100, rarity: "epic", zone1: false, zone2: false, zone3: false, zone4: true, zone5: false },
];

const JUNK = [
    "'My Other Wagon is a TARDIS' wagon-sticker.",
    "A 'Buffalo Wings' recipe that involves actual wings and zero hot sauce",
    "A 'Get Out of Dysentery Free' card (Void where prohibited by RNG)",
    "A 'No Soliciting' sign intended for the front of a wagon",
    "A 'Platte' of cold leftovers",
    "A 'Snake River' logic puzzle—it's just a live rattlesnake in a box",
    "A 'Student of the Month' bumper sticker for a kid who currently has Bieber Fever",
    "A 'Word Muncher' dictionary with several letters missing",
    "A 'World's Okayest Pioneer' coffee mug (hand-carved from a buffalo hoof)",
    "A Bible belt buckle",
    "A bird bath and beyond",
    "A blaseball",
    "A blue police box that's surprisingly heavy and definitely wasn't here a second ago",
    "A bottle of Mikes Semi-Hard Lemonade",
    "A can of duck soup",
    "A chaise lounge",
    "A Cleveland femur",
    "A clown shoe",
    "A concrete canoe",
    "A copy of Odell Lake for the Apple II",
    "A copy of the Necronomicon",
    "A cracked pipe",
    "A crusty sock",
    "A crusty sponge named Bob",
    "A deep fake",
    "A dirty asstray",
    "A discarded 'Live, Laugh, Love' sign carved into a piece of driftwood",
    "A discarded floppy disk labeled 'Freedom! (1993)' that won't stop screaming",
    "A discarded red stapler once belonging to a man named Milton",
    "A fish hook up",
    "A freemason jar",
    "A frontyard milkshake",
    "A get over writ",
    "A glass onion ring",
    "A glitched-out 8-bit rock that flickers when you look at it",
    "A golden ticket that has already been used by some kid named Charlie",
    "A green 'Number Muncher' trophy with a bite taken out of it",
    "A handwritten note: 'The princess is in another river crossing'",
    "A haystack in a needle",
    "A health pack that only restores 1 HP because you're playing on 'Grueling'",
    "A hitchhiker towel",
    "A hoedown",
    "A jar containing a single, very lonely sourdough starter",
    "A jar of 'Essential Oils' that is actually just snake oil and pond water",
    "A jar of 'Organic, Gluten-Free' axle grease",
    "A Jiminy Cricket Bat",
    "A letter unopener",
    "A literal and figurative easter egg",
    "A little blouse on the prairie",
    "A loot box that requires a key you'll never find",
    "A map of Oregon that is just a drawing of a middle finger",
    "A message in a bottle containing only a link to a Rick Astley song",
    "A message in a bottle: 'We've been trying to reach you about your wagon's extended warranty'",
    "A mysterious black slab that hums slightly and smells like ozone and regret",
    "A mystery box labeled 'Do Not Open Until 1985'",
    "A Nigerian Prince phishing scam",
    "A nine inch nail",
    "A nonfungible token",
    "A pair of 'Pioneer' brand noise-canceling headphones (It's just two potatoes tied to a string)",
    "A pair of unwashed junk drawers",
    "A pair of Yeezy-brand moccasins that have clearly seen better days",
    "A petition to rename the Platte River to 'Bison-Scented Mud-Stream'",
    "A PHISH band shirt",
    "A piece of eden",
    "A piece of eight",
    "A pint of rice cream",
    "A pixelated Mackinaw Trout that looks like it belongs in Odell Lake",
    "A plague rat",
    "A receipt for one 'Flux Capacitor'—Refund Denied",
    "A recipe for 'Secret Sauce' from an 8-bit burger joint",
    "A RL Beer Stein",
    "A rock with a face painted on it named Wilson",
    "A rolling pin-up",
    "A save point that has been corrupted by pond water",
    "A septic plank",
    "A shuttlecock and balls",
    "A small rock with 'Property of the IRS' painted on it",
    "A smear window",
    "A soggy flyer for a 'Lemonade Stand' that went bankrupt during a rainy day",
    "A spider monkey wrench",
    "A sponge glob",
    "A stack of 'Save the Date' cards for a wedding the family clearly didn't make it to",
    "A stained ass window",
    "A stone tablet engraved with 'Top 10 Reasons to Leave Missouri (Number 7 Will Shock You!)'",
    "A strip croquet mallet",
    "A swouth pole",
    "A teratoma",
    "A TF2 hat",
    "A triforce piece",
    "A trunk full of junk",
    "A tutorial pop-up for a 'Double Jump' mechanic that doesn't work in this engine",
    "A vest in gate",
    "A Vogon poem",	
    "A water chip",
    "A weathered coupon for Matt's General Store that expired in 1847",
    "A well-used chamber pot",
    "A Yelp review for the Kansas River Crossing: '1 star. Too much water, and the ferryman was rude'",
    "An 1848 'Coexist' bumper sticker for the side of a wagon",
    "An 1848 participation trophy for 'Most Days Survived Without Dysentery'",
    "An ancient, water-damaged copy of 'Oregon Trail for Dummies'",
    "An animal cracker barrel",
    "An ear wax candle",
    "An empty meat wallet",
    "IKEA instructions for an entertainment center",
    "Most of a dead cat",
    "Some blubber gloves",
    "Some combed beef",
    "Some fish eyes",
    "Some jeggings",
    "Some junk trinket called the Amulet of Yendor",
    "Some more cowbell",
    "Some Quaker instant goatmeal",
    "Some soggy Apeture Science cake",
    "Some tickle pickles",
    "The Face of Bo",
    "The poison for Kuzco",
    "The Skull of Mondain",
];

const POKE_MOVES = {
    "Worm-mander": ["String Shot", "Bug Bite", "Silk Wrap", "Power Reel"],
    "Bait-asaur": ["Vine Whip", "Razor Leaf", "Sleep Powder", "Power Reel"],
    "Squirt-le-Lure": ["Water Gun", "Bubble", "Withdraw", "Power Reel"]
};

const BAG_ITEMS = {
    "Forgotten Leftovers": { type: "passive", effect: "Heals 5 HP every turn." },
    "Citrus Barry Burton": { type: "active", effect: "Restores 25 HP immediately." },
    "Anti-Life Orb": { type: "boost", effect: "Increases damage by 50% for the rest of battle." }
};

const BAIT_DESCRIPTIONS = {
    "Worm-mander": "It burrows deep into rich soil, using its leafy camouflage to hide from predators while eagerly awaiting a fish. Anglers claim its slightly wiggly demeanor is irresistible to Salmon-sprites and trout-mon.",
    "Squirt-le-Lure": "The Trick-Shell Bait. It mimics a rare water creature to attract larger predators. By creating small vortexes with its propeller-tail and spinning its lure-funs, it drives Salmon-sprites and trout-mon into a frenzy. It's said that even the most cautious fish cannot resist its charming dance.",
    "Bait-asaur": "The Fire-Lure Bait. Using its internal furnace, it generates an intense, pulsating heat and a bright flame that mimics a distressed insect. Fish in cold, dark water are irresistibly drawn to its warm glow, making it a favorite for night-time fishing on the trails."
};

const MOVE_DATA = {
    // --- Worm-mander ---
    "Bug Bite":    { dmgMin: 9, dmgMax: 11, effect: null },
    "String Shot": { dmgMin: 6, dmgMax: 8,  effect: "weaken_next", magnitude: 0.30 },
    "Silk Wrap":   { dmgMin: 7, dmgMax: 9,  effect: "bonus_hit_chance", magnitude: 0.30 },

    // --- Bait-asaur ---
    "Vine Whip":    { dmgMin: 9,  dmgMax: 11, effect: null },
    "Razor Leaf":   { dmgMin: 12, dmgMax: 16, effect: "miss_chance", magnitude: 0.28 },
    "Sleep Powder": { dmgMin: 5,  dmgMax: 7,  effect: "skip_chance", magnitude: 0.35 },

    // --- Squirt-le-Lure ---
    "Water Gun": { dmgMin: 9, dmgMax: 11, effect: null },
    "Bubble":    { dmgMin: 7, dmgMax: 9,  effect: "stack_weaken", magnitude: 0.10, maxStacks: 2 },
    "Withdraw":  { dmgMin: 0, dmgMax: 0,  effect: "mitigate_next", magnitude: 0.5 },
};

const MOVE_DESCRIPTIONS = {
    "Bug Bite": "Reliable. No surprises, no drawbacks — the default for a reason.",
    "String Shot": "Weaker hit, but webs the fish down: its next attack on you lands 30% softer.",
    "Silk Wrap": "Binds the fish — 30% chance to get a free extra strike in the same turn.",
    "Vine Whip": "Reliable. No surprises, no drawbacks — the default for a reason.",
    "Razor Leaf": "Your hardest-swinging move, but a wild cast has a 1-in-5 chance to whiff completely.",
    "Sleep Powder": "Weak on its own, but a good cloud has a real chance of skipping the fish's next turn entirely.",
    "Water Gun": "Reliable. No surprises, no drawbacks — the default for a reason.",
    "Bubble": "Doesn't hit hard, but wears the fish down — each use permanently softens its future attacks (stacks up to 2x).",
    "Withdraw": "No damage at all. Halves the next hit you take. For when you need to survive, not win.",
};

const EPIC_SIGNATURE_MOVES = {
    "Elon Muskellunge":       "Hostile Takeover",
    "Without a Paddlefish":   "Up a Creek",
    "Pacific For the Halibut": "Just For the Halibut",
    "Sturgeon-General":       "Executive Order",
    "Pit Bull Shark":         "Death Roll",
    "Nigerian Prince":        "Wire Transfer",
};
const EPIC_SIGNATURE_MOVE_CHANCE = 0.30;
const EPIC_SIGNATURE_MOVE_DMG_MIN = 13;
const EPIC_SIGNATURE_MOVE_DMG_MAX = 19;
const EPIC_SIGNATURE_MOVE_DEFAULT_NAME = "Undertow";

const ProfessionSkills = {
    "Doctor": "Medical",
    "Merchant": "Trade",
    "Gunsmith": "Sharpshooting",
    "Carpenter": "Repair",
    "Fisherman": "Fishing",
    "Hunter": "Tracking",
	"Guide": "Survival",
    "Farmer": "Animal Handling",
    "Prospector": "Prospecting",
    "Tailor": "Sewing"
};

const MonthTempModifiers = {
    "January": -24,
	"February": -21,
    "March": -12,
	"April": 0, 
	"May": 8,
	"June": 17, 
    "July": 23,
	"August": 22,
	"September": 13,
	"October": 2,
	"November": -12,
	"December": -21,
};

const MonthPrecipModifiers = {
    "January": -0.05,
	"February": -0.01,
    "March": -0.06,
	"April": 0.02, 
	"May": 0.06,
	"June": 0.04, 
    "July": -0.01,
	"August": -0.01,
	"September": 0.01,
	"October": -0.02,
	"November": -0.02,
	"December": -0.02,
};

const MonthDays = {
    "January": 31, "February": 28, "March": 31, "April": 30, "May": 31, "June": 30, 
    "July": 31, "August": 31, "September": 30, "October": 31, "November": 30, "December": 31
};

const RiverData = {
    "Kansas River Crossing": { maxWidth: 640, baseWidth: 620, minWidth: 600, maxDepth: 50, baseDepth: 40, minDepth: 30, ferry: true, guide: false, baseCost: 4.00, animalCost: 0.25, personCost: 0.10, diff: 1 },
    "Big Blue River Crossing": { maxWidth: 275, baseWidth: 180, minWidth: 150, maxDepth: 60, baseDepth: 30, minDepth: 20,  ferry: false, guide: false, diff: 3 },
    "Green River Crossing": { maxWidth: 280, baseWidth: 260, minWidth: 240, maxDepth: 60, baseDepth: 40, minDepth: 20,  ferry: true, guide: true, baseCost: 5.00, animalCost: 0.0, personCost: 0.0, diff: 1 },
	"Snake River Crossing": { maxWidth: 1200, baseWidth: 1100, minWidth: 1000, maxDepth: 60, baseDepth: 30, minDepth: 15,  ferry: false, guide: false, diff: 5 },
	"Humboldt River": { maxWidth: 150, baseWidth: 100, minWidth: 40, maxDepth: 36, baseDepth: 20, minDepth: 10, ferry: false, guide: true, diff: 3 },
	"Wonka's Chocolate River": { maxWidth: 500, baseWidth: 450, minWidth: 400, maxDepth: 53, baseDepth: 32, minDepth: 19, ferry: false, guide: true, diff: 5 },
	"The Uncanny Valley": { maxWidth: 500, baseWidth: 450, minWidth: 400, maxDepth: 53, baseDepth: 32, minDepth: 19, ferry: true, guide: true, diff: 4 },
};

const ILLNESSES = [
    { id: 1, name: "Dysentery" },
    { id: 2, name: "Gonorrhea" },
    { id: 3, name: "Yellow Fever" },
    { id: 4, name: "Pertussis" },
    { id: 5, name: "Broken Arm" },
    { id: 6, name: "acne" },
    { id: 7, name: "ADHD" },
    { id: 8, name: "Adrenochrome Withdrawal" },
    { id: 9, name: "AIDS" },
    { id: 10, name: "Albinism" },
    { id: 11, name: "Alzheimers" },
    { id: 12, name: "Amnesia" },
    { id: 13, name: "Anal Leakage" },
    { id: 14, name: "Autism" },
    { id: 15, name: "Avian flu" },
    { id: 16, name: "Bad Breath" },
    { id: 17, name: "Balding" },
    { id: 18, name: "Banana-sized Warts on your Banana" },
    { id: 19, name: "Bieber Fever" },
    { id: 20, name: "Black Lung Disease" },
    { id: 21, name: "Brain Worms" },
    { id: 22, name: "Butt Cancer" },
    { id: 23, name: "Cataracts" },
    { id: 24, name: "Catching The Gay" },
    { id: 25, name: "Chronic Diarrhea" },
    { id: 26, name: "Chronic Halitosis" },
    { id: 27, name: "Chronic Swamp Gas" },
    { id: 28, name: "Consumption" },
    { id: 29, name: "COVID-19" },
    { id: 30, name: "Crabs" },
    { id: 31, name: "Crotch Rot" },
    { id: 32, name: "Diarrhea of the Mouth" },
    { id: 33, name: "Dropsy" },
    { id: 34, name: "Ebola" },
    { id: 35, name: "Elephantitus of the Testicles " },
    { id: 36, name: "Erectile dysfunction" },
    { id: 37, name: "Explosive earwax disorder" },
    { id: 38, name: "Flaming hemorrhoids" },
    { id: 39, name: "Ghost Herpes" },
    { id: 40, name: "Glitter Lung" },
    { id: 41, name: "Gluten sensitivity" },
    { id: 42, name: "Gout" },
    { id: 43, name: "Hairy Palms" },
    { id: 44, name: "Fart Disease" },
    { id: 45, name: "Hemorhoids" },
    { id: 46, name: "Blood Pressure higher than Snoop Dog" },
    { id: 47, name: "Hyperhidrosis" },
    { id: 48, name: "Irritable Bastard Syndrome" },
    { id: 49, name: "Itchy Bottom" },
    { id: 50, name: "Joint Pain" },
    { id: 51, name: "Klingon measles" },
    { id: 52, name: "Leukemia" },
    { id: 53, name: "Liver Spots" },
    { id: 54, name: "Long COVID" },
    { id: 55, name: "Lycanthropy" },
    { id: 56, name: "Lyme disease" },
    { id: 57, name: "Mad Cow Disease" },
    { id: 58, name: "Mad Ox Disease" },
    { id: 59, name: "Malaria" },
    { id: 60, name: "Measels" },
    { id: 61, name: "Melanoma" },
    { id: 62, name: "Mesothelioma" },
    { id: 63, name: "Microchip fever" },
    { id: 64, name: "Myopia" },
    { id: 65, name: "Nymphomania" },
    { id: 66, name: "Parkinsons" },
    { id: 67, name: "Pepperoni Nipples" },
    { id: 68, name: "Peyronie's Disease" },
    { id: 69, name: "Plague of Boils" },
    { id: 70, name: "Restless Third-Leg Syndrome" },
    { id: 71, name: "Rickets" },
    { id: 72, name: "River Cooter" },
    { id: 73, name: "Rocky Mountain Spotted Fever" },
    { id: 74, name: "SARS" },
    { id: 75, name: "Scabies" },
    { id: 76, name: "Schizophrenia" },
    { id: 77, name: "Scurvy" },
    { id: 78, name: "Shrek Pox" },
    { id: 79, name: "Small-Cocks" },
    { id: 80, name: "Smallpox" },
    { id: 81, name: "Squirty Farts" },
    { id: 82, name: "Swamp Ass" },
    { id: 83, name: "Swamp Foot" },
    { id: 84, name: "the Black Plague" },
    { id: 85, name: "Ulcers" },
    { id: 86, name: "Unnatural Discharge" },
    { id: 87, name: "Vampirism" },
    { id: 88, name: "Vitiligo" },
    { id: 89, name: "Zombie Virus" },
    { id: 90, name: "Greyscale" },
    { id: 91, name: "Simian Flu" },
    { id: 92, name: "The Andromeda Strain" },
    { id: 93, name: "Geostigma" },
    { id: 94, name: "The Phage" },
    { id: 95, name: "Las Plagas" },
    { id: 96, name: "Dissin' Terry" },
    { id: 97, name: "Double Dysentery" },
    { id: 98, name: "Deadly Dysentery" },
    { id: 99, name: "Ox Dysentery" },
    { id: 100, name: "Wagon Fever" },
	{ id: 101, name: "Gingervitis" },
];

const DEATH_CAUSES = [
	"A Merchant to the end. I'd sell this plot for a biscuit.",
	"Accidentally Alt-F4'd their own life.",
	"Actually died of boredom in Nebraska.",
	"Argued with a 'Student Driver' wagon. The wagon won.",
	"Argued with an ox. The ox won.",
	"Ate the 'Not-Poison' berries. Narrative arc complete.",
	"Attempted a speed-run. Hit a wall at frame 1.",
	"Beats living in Missouri.",
	"Became a penguin. Penguins don't do well in Kansas.",
	"Built a campfire inside their wagon.",
	"Buried on the 1st. Died on the 2nd.",
	"Character model clipped through the wagon floor.",
	"Choked on a low-poly apple.",
	"Choked on trail dust while laughing at someone else's dysentery.",
	"Contracted Gingervitis. Died of soul-loss.",
	"Controller disconnected during a stampede.",
	"Cuddled with a Black Bear on a cold winter night.",
	"Danced with a train. It is a terrible dance partner.",
	"Deleted by the Architect.",
	"Died doing what I loved: failing RNG rolls.",
	"Died of 'River Fever' while looking for a sexy fishman.",
	"Died of Dysentery (Classic Edition)",
	"Dreamt I was in a gunfight. Can't even win in my dreams.",
	"Drowned in 2 inches of water.",
	"Eaten by a Vorpal Bunny.",
	"Error 404: Soul not found.",
	"Failed a Quick-Time Event during a sneeze.",
	"Finally found the 'Content Desert.' It was very literal.",
	"Finally, some peace and quiet away from the kids.",
	"Folded into a small square and blew away.",
	"Forgot to save their game.",
	"Fought the law and the law won.",
	"Found a 'Fast Travel' glitch. It sent them here.",
	"Found the edge of the skybox.",
	"Fucked Around. Found Out.",
	"Game Over. Please insert 25 cents to continue (1848 value).",
	"Gamer.exe has stopped working. Send report?",
	"Heard the names of their ancestors in the wind and followed them off-map.",
	"Here lies a 'Placeholder Asset'.",
	"I have nothing further to say.",
	"I smoked dynamite. It blew my mind.",
	"I told you I was sick. But you didn't want to stop and rest.",
	"I wanted an urn, not this pixelated mess.",
	"Inventory full. Dropped their own heart to make room for bullets.",
	"Is it a grave, or just a really deep save point?",
	"It was dark. Was eaten by a Grue.",
	"Lagged during a river crossing.",
	"Left Missouri with no food and tons of bullets. Wasn't a good shot.",
	"Looking for a 'Wi-Fi' signal in the afterlife.",
	"Lost a duel with their own ungreased axle.",
	"Mistook a 'Stampede' for a parade. One-star review.",
	"Mistook a pixel-python for a colorful belt.",
	"Now go away and leave me alone.",
	"Now reading the 'How to Not Die' book. A bit late.",
	"Paid for the 'Immortal' skin. No refunds.",
	"Poorly Born, Poorly Lived, Poorly Died, and no one cried",
	"Ran out of lives in a single-player world.",
	"Ran out of pixels.",
	"Realized they were made of meat and lost the will to exist.",
	"Sacrificed to the Donners. They said I tasted like chicken.",
	"Should have taken the shortcut. Actually, any road but this one.",
	"Stalin's Grave is a Communist Plot.",
	"Stuck in a 'Jesus Take the Wheel' loop.",
	"Stuck in a 'Live, Laugh, Love' buffalo skull loop.",
	"Subscription to Life™ cancelled by the trail.",
	"Successfully reinvented the wheel, but forgot the wagon.",
	"Swallowed a fly. It was a 'Severe' case of regret.",
	"The oxen are laughing at me. I can hear them.",
	"Thought gravity was just a suggestion and walked off a cliff.",
	"Thought the 'Permadeath' toggle was just a prank.",
	"Traveled the snowy mountains with no clothes. Wasn't smart.",
	"Tried to 'Alt-F4' out of a cannibal dinner party.",
	"Tried to 'Double Jump' a canyon.",
	"Tried to 'Equip' a cactus. Now they are a pincushion.",
	"Tried to befriend a 'Square Cow'. It wasn't friendly.",
	"Tried to Chevy the river",
	"Tried to fight Bigfoot with a spoon.",
	"Tried to min-max their sanity. Ended up at 0.",
	"Tried to trade a 'Crusty Sock' for a soul.",
	"Tried to walk to the end of the skybox.",
	"Tried to wrestle Bigfoot.",
	"Vibrated out of existence due to high-latency madness.",
	"Voted off the trail by their family.",
	"Waited for a 'Day One' patch that never came.",
	"Waiting for the DLC to arrive.",
	"Want to Crack Open a Cold One? Take Me Out Tonight.",
	"Was AFK during a bandit ambush. Bad timing.",
	"Was exploring Odell Lake. Couldn't swim",
	"Was Munching Numbers. Was eaten by a Troggle",
	"Was shot by Dick Cheney. Apologized to Dick in their dying breath.",
	"Was waiting for a 'Rest' day. They got a permanent one.",
	"Well, this sucks.",
	"Won the bet. Lost my life.",
];

const NPC_names = [
	"Al B. Back",
	"Al Coholic",
	"Alex Blaine Laider",
	"Amos Quito",
	"Anita Break",
	"Artie Fishal",
	"Axel Foley",
	"Banker Bob",
	"Barb Dwyer",
	"Barb Wire",
	"Barlow Barlow",
	"Baron Von Wagon",
	"Barry D'Live",
	"Barry M. Deep",
	"Ben Dover",
	"Betty Didnt",
	"Bill Board",
	"Bob Granvin",
	"Buck Shot",
	"Buffalo Bill-ion",
	"C. F. Sunder",
	"C. Yalater",
	"Cactus Jackass",
	"Calamity Jane (The Second)",
	"Carrie Oakey",
	"Caulk-and-Float Charlie",
	"Charolyn Kapplinger",
	"Chevy Chaser",
	"Cole Miner",
	"Constant Cougher",
	"Copped A. Bullet",
	"Dee Kay",
	"Diane Rott",
	"Dick O'Tater",
	"Dietary Jerky",
	"Don Rawitsch",
	"Dusty 'No-Shoes' Miller",
	"Dusty Trails",
	"Eileen Dover",
	"Ella Vator",
	"Emma Goner",
	"Ferry Godmother",
	"George Donner Jr.",
	"Glitchy Greenhorn",
	"Goldie Locks",
	"Hal Lucinate",
	"Hank Kerchief",
	"Holden Tudors",
	"Hugh Jass",
	"I. M. Deady",
	"I.P. Freely",
	"Izzy Back",
	"Jedediah 'Dysentery' Smith",
	"Joe King",
	"John Krenz",
	"Justin Case",
	"Justin Time",
	"Lee Ving-Soon",
	"Ma Kettle",
	"Marshal Law",
	"Masonic Matt",
	"Mike Hunt",
	"Mike Rotch",
	"Misty Mountain",
	"Moe Ron",
	"Mournin' Joe",
	"Noah Scape",
	"Nora Grets",
	"Number Muncher Nick",
	"Old Man 'Ox-Breath' Jenkins",
	"Oliver Klosoff",
	"Otto Graph",
	"Owen Moore",
	"Oxen Oscar",
	"Pa Kettle",
	"Pa Looza",
	"Pa Staway",
	"Pat Pending",
	"Paul Bearer",
	"Perry Noid",
	"Phil Dirt",
	"Pity-Meter Pete",
	"Pony Up",
	"Prudence Pains",
	"R. Philip Bouchard",
	"Ray Diation",
	"Rick Mortis",
	"River Styx",
	"Robin Graves",
	"Roger Shimada",
	"Rusty Hinges",
	"Rusty Nail",
	"Saddle Sore",
	"Samon Ella",
	"Save-Scum Sammy",
	"Seymour Butz",
	"Shirley Keran",
	"Sister Wife Sarah",
	"Sublette Shortcut",
	"Sue Flay",
	"Sye Klone",
	"T-Posing Todd",
	"Terry Cloth",
	"Tex Mex",
	"Thaddeus 'Lost-a-Toe' Thompson",
	"Tim Burr",
	"Ty Knotts",
	"Upton O'Good",
	"Wagon-Wheel Willie",
	"Wagonner T. Wright",
	"Wanda Lust",
	"Warren Peace",
	"Willie Bi-Buryed",
	"Willie Makit",
	"Zack Lydead",
];


const STORYTELLING_VERBS = [
    "accidentally married",
    "arm-wrestled",
    "became lifelong friends with",
    "blazed new trails with",
    "bribed",
    "fought bandits alongside",
    "gave beans, beans and more beans to",
    "gave dysentery to",
    "gave special jerky to",
    "got dysentery from",
    "insult-dueled",
    "lost a bet to",
    "munched numbers with",
    "negotiated a truce with",
    "out-danced",
    "out-dueled",
    "out-glared",
    "out-stared",
    "out-stubborned",
    "out-yodeled",
    "performed field surgery on",
    "played liar's dice with",
    "punched cows with",
    "punched trees with",
    "recited poetry at",
    "rode into the sunset with",
    "scouted for danger with",
    "serenaded",
    "swapped recipes with",
    "swapped Sister Wives with",
    "taught long division to",
    "tended the herd with",
    "tracked Bigfoot alonside",
    "traded a wagon wheel for a rematch with",
    "traded my last clean shirt to",
    "traded Pokébait with",
    "travled the trail with",
    "visited a brothel with",
    "won a staring contest against",
];

const hints = [
    "What can I say about Independence, Missouri? People are excited to drag their families on a deadly journey to escape it. Good luck!",
	"The Nebraska Territory is not real. You cannot convince me otherwise.",
	"Better take extra sets of clothing. Trade 'em to Indians for fresh vegetables, fish, or meat. Or if you are feeling really creative you can wear the clothing to protect from the Rocky Mountain snow.",
	"It's well worth hiring an Indian guide at river crossings. Expect to pay them! They're sharp traders, not easily cheated. Sure, we took advantage of them when we first landed here, but someday they will have casinos and take our money.",
	"Did you read the Missouri Republican today? --Says some folk start for Oregon without carrying spare parts, not even an extra wagon axle. Must think they grow on trees! Everyone knows wood doesn't grow on trees.",
	"If you are lucky you might find an abandoned wagon on the trail with extra supplies. Just don't lose sleep thinking about why the wagon is abandoned or why there is no trace of the family!",
	"Some folks seem to think that two oxen are enough to get them to Oregon! Two oxen can barely move a fully loaded wagon, and if one of them gets sick or dies, you won't be going anywhere. I wouldn't go overland with less than six. They're also fluffy and good company.",
	"I'm willing to wait and pay for a ferry. Can you imagine trying to cross a moving river in a rickety wagon boat? Those people will probably drown their kids.",
	"We're making our wagon into a boat to caulk and float it across, but our guide said something about turning into a submarine.",
	"Some crazy hunter told me saw Bigfoot. I told him to lay off the moonshine.",
	"Don't try to ford any river deeper than the wagon bed--about two and a half feet. You'll swamp your wagon and lose your supplies. Unless you're trying to invent the first wagon waterbed in 1848.",
	"We've had enough! Pesky flies all day and mosquitoes all night! It's either baking sun or oceans of mud--and sometimes both. Ol' Twitch over there got struck by some lightning!",
	"I am bored to death! The only excitement is the occassional bandit attack. They killed Carl, but it was exciting.",
	"This prairie is mighty pretty with all the wild flowers and tall grasses. But there's too much of it! I dream of a future when this is all strip malls!",
	"I wonder how many days until I see a town--a town with real shops, a church, people... I mean we left a town to brave death to go somewhere new because that town stunk. But we'll start a new one with blackjack and hookers!",
	"Be careful you don't push those animals too hard! Keep 'em moving but set them a fair pace. With an injured or dead ox, you won't be moving at any pace.",
	"The trails from the jumping off places --Independence, St. Joseph, Council Bluffs--come together at Fort Kearney. This new fort was built by the U.S. Army to protect those bound for California and Oregon. Even the federal government knows no one wants to live in Council Bluffs!",
	"The Platte River valley forms a natural roadway from Fort Kearney to Fort Laramie. Travelers bound for California, Utah, and Oregon all take this road. Could be the easiest stretch of the whole trip. Should see antelope and plenty of buffalo. After the easy stretch, prepare to starve and die.",
	"The game is still plentiful along here, but gettin' harder to find. With so many overlanders, I don't expect it to last more'n a few years. Folks shoot the game for sport, take a small piece, and let the rest rot in the sun. Surely you'd never do that, right?",
	"I hear terrible stories about wagon parties running out of food before Oregon --the whole party starving to death. Always plan for the worst. That is what George Donner always told me.",
    "I'd tell you how to cross the Kansas River, but that would spoil the fun of watching you tip over and drown.",
    "People ask me if I regret coming on this trail. I say: 'Ask me again after I've eaten my own boots for dinner.'",
    "They say oxen are the most important part of your journey. They're also delicious when you run out of everything else.",
    "The Rocky Mountains are beautiful this time of year. Specifically, the part where you freeze to death.",
    "If you want to move faster, just tell your family that the sooner you finish the trail, the sooner you stop dying of preventable diseases.",
    "I wouldn't worry about the snake bites. It's the 'River Fever' you really have to watch out for. Or just the water. It's all terrible.",
    "I heard the Kansas River is lovely this time of year. If you like the taste of mud and despair.",
    "Make sure to buy enough bullets. You can't eat scenery, but you can shoot it.",
    "They say dysentery is just your body's way of saying 'I give up'. Don't listen to them.",
    "If you see Bigfoot, don't shoot. He's actually a very sensitive poet. He is a very chill guy.",
    "The best way to cross a river is to hire a guide. The second best way is to close your eyes and pray. The third best way is a Chevy, but we don't talk about that.",
    "Don't worry about the oxen. They're much tougher than your kids. And easier to replace.",
    "Chimney Rock is a great landmark. It looks like a chimney. Groundbreaking stuff, I know.",
    "Always keep your pace steady. Unless you're in a hurry to die, then go Grueling. It's much more efficient.",
    "Soda Springs has naturally carbonated water. It's like God's own seltzer, minus the overpriced branding.",
    "If you run out of food, remember: leather boots are technically organic. Chewy, but organic.",
    "A Merchant gets a trade bonus, but a Banker gets $1600. It's the classic struggle between 'actually having a soul' and 'having enough money to buy one'.",
    "Don't forget to rest. Your party members need it, and it gives you a chance to rub some dirt on their wounds. It's practically medical science.",
    "South Pass is where the trail splits. Choose wisely, or just flip a coin. It's not like your survival depends on it. Oh wait, it does.",
    "The Blue Mountains are blue. Fort Walla Walla is... a lot of Wallas. I'm a font of information.",
    "If your wagon wheel breaks and you don't have a spare, just listen for the faint sound of Carrie Underwood singing 'Jesus Take the Wheel'. It won't help, but it's a nice vibe.",
	"People keep saying this Chimney Rocks. There is no hole! It doesn't rock as a chimney at all!",
	"Be warned, stranger. Don't dig a water hole! Drink only river water. Salty as the Platte River is--it's better than the cholera. We buried my husband last week. I recknon he died a day later.",
	"These greenhorns heading across the Rockies know nothing about surviving in the mountains. It gets awful cold up there, even in summer. Stay warm anyway you can. But clothing helps.",
	"I carved my name way up the side of Independence Rock, near the top. There are hundreds of names up there! The oldest ones were carved by mountain men and fur trappers --famous names like Pontiac Bonneville!",
	"No butter or cheese or fresh fruit since Fort Laramie! Bless me, but I'd rather have my larder full of food back East than have our names carved on Independence Rock! Well, tis a sight more cheery than all the graves we passed. Though some did have funny names.",
	"Goodbye Platte River! Goodbye sand hills and white buffalo skulls! Now we climb the Sweetwater valley to cross the Continental Divide at South Pass. Once across the Rockies, we'll make a steep descent into the Green River valley. That is, if we survive that long.",
	"My family and I travel with 40 other families to the valley of the Great Salt Lake to seek religious freedom. Back east, Mormons are persecuted. In Utah, we'll join together to build a new community, changing desert into farm land. And maybe someday have a Sister Wives reality show.",
	"My father is very sick and we are resting here until he gets better. We have been pushing too hard and our health has suffered. When my father is able to travel again, we will go at a slower pace, or maybe reload an earlier save.",
	"One child drowned in a swollen creek east of Fort Laramie. My husband died of typhoid near Independence Rock. Now I travel alone with my five children. The eldest step-son is Caleb. I fear he'll be a man before we reach Oregon. It depends if I get stuck in the wash.",
	"Fort Bridger was built by Jim Bridger. Jim was a mountain man before he put in this blacksmith shop and small store to supply the overlanders. Does a big trade in horses, Jim and his partner, Vasquez. We should all be so lucky as to settle down with our partner.",
	"We should've taken the Sublette Cutoff! Not enough at the fort worth the time it took to get here. And the outrageous prices! Food's not fit to eat, much less pay for. But what are we going to do? Restart the game?",
	"Five dollars to ferry us over the Green River? Those ferrymen'll make a hundred dollars before breakfast! We'll keep down river until we find a place to ford our wagon and animals. What little money we have left, we'll keep to squander elsewhere on blackjack and hookers!",
	"My family didn't buy enough food in Independence. We have been eating very small rations since Fort Laramie. Because of that our health is poor. My sister has Bieber Fever.",
	"They say there are no shortcuts in life. But a shortcut on the Oregon Trail can be the difference between making it there before running out of food, or reloading your save game.",
	"I am risking everything to try and provide a better life for my family out West. Not everyone survives the trip. I hope future generations don't meme my husband dying of dysentery.",
	"All your base are belong to us. You are on the way to destruction. You have no chance to survive make your time.",
	"Me perro es en fuego.",
	"My, the Soda Springs are so pretty!  Seem to spout at regular intervals. Felt good to just rest and not be jostled in the wagon all day. When I get to Oregon, I'll have a soft feather bed and never sleep in a wagon again, except for special occassions.",
	"My job every day is to find wood for the cook fire. Sometimes it's very hard to find enough. On the prairie I gathered buffalo chips to burn when there wasn't any wood. They smoke the food with a lovely flavor!",
	"Well, friend, this is where we part. I'm bound for California with an imposing desert to cross. And you--you're going to drown in the Snake River. The Missus and I will visit your grave markers from time to time.",
    "Hear there's mountain sheep around here if you are lonely. Enough water too, but hardly a stick of wood. Thank heaven for Fort Hall!  But I'm real sorry to be saying goodbye to cousin Miles and all the folks heading for California. No sheep there to keep you warm.",
	"Fort Hall is a busy fort! The wide stretches of meadow grass here are just what our tired animals need. And they have a fantastic brothel, which is just what tired papas need.",
	"Down there between those steep lava gorges, twisting and writhing, is the Snake River. You have fun with that, you maniac.",
	"We've got many miles of desert before Oregon, which is a wonderful place to hallucinate on Ayahuasca in peace.",
	"See that wild river on the map? That's the Snake. Many a craft's been swamped in her foaming rapids. Her waters travel all the way to Oregon! We'll be crossing her soon, and then again after Fort Boise. It is so deadly, you should take your wagon in it twice.",
	"You'll not get yer wagon over them Blue Mountains, mister. Leave it! Cross yer goods over with pack animals. Get yerself a couple of good mules. They make good company, in more ways than one.",
	"Every night, even though I ache from the day's toils, my head is filled with dreams of the rich farm land of the Willamette Valley. I will build myself a fine, handsome homestead--and I'm certain I'll be rich within five years or dead of dysentery in four.",
	"Since crossing the Snake at Fort Boise, it's been just mountains and desert. Dust deeper each day--six inches at times. No tracks, just clouds of dust. Many cattle choked on the dust after swimming the river, then bled and died. But now we can grill 'em up! Eat up boys!",
	"We followed the edge of the desert from Fort Boise to the forbidding wall of the Blue Mountains. The hills were dreadful steep!  Locking both wheels and coming down slow, we got down safe. Poor animals! No grass or water for days. The kids stopped complaining about no water a few days ago.",
	"This valley of the Grande Ronde is the most beautiful sight I've seen in months. Water and graze in abundance! And if this valley is so fine, the Willamette must be twice as fine! We'll be sittin' pretty in our new homestead! And if we hear of even nicer grass, we'll pick up for another deadly wagon trip.",
	"My kids all died of preventable diseases along the trail. Surely future generations won't make the same mistake",
	"These last hundred miles to the Willamette Valley are the roughest--either rafting down the swift and turbulent Columbia River or driving your wagon over the steep Cascade Mountains. Hire an Indian guide if you take the river. Better yet hire a Priest and pray!",
	"We tried floating our wagon across the Kansas when the river was high. The wagon overturned in the middle of the river and we lost everything we had. But we're not giving up!  We'll be back and try again to lose new stuff!",
	"You need to decide when to set off on the trail. If you leave too early, there won't be much grass for your oxen to eat. You may encounter some very cold weather and late spring snow storms. If you wait way too long you're stuck living in Missouri. No one wants that.",
	"Some folks spend all their money in Independence. Don't be that guy. You need cash for ferries, guides, and for bribing the game engine not to kill your lead ox.",
	"If your party members are constantly sick, you might be moving too fast. Or maybe they just don't like the food. Have you tried not feeding them exclusively salted pork?",
	"Repairing a wagon axle is a life skill. Much like knowing how to identify a poisonous berry, or how to avoid dying of boredom while waiting for the turn to end.",
	"Don't sell your clothes for food unless you're near a fort. Walking through the desert in your undergarments is a bold fashion statement that the game engine interprets as 'inviting heatstroke'.",
	"They call it the 'Great Platte River Road.' I call it 'The Path of Ten Thousand Buffalo Skulls.' Sounds less inviting, but it's more accurate.",
	"The fur trappers at Fort Laramie have seen it all. They've seen thousands of people pass through, and they’ve seen thousands of people die. They’re very desensitized. Don't expect a hug.",
	"If you reach the Blue Mountains and feel a sense of relief, you've clearly forgotten that the Willamette Valley is still another hundred miles of 'are we there yet?' and dying of thirst.",
	"I once heard a man say he survived on nothing but hope and grit. He died two days later. Turns out, you need food, too.",
	"Independence Rock is basically the 1848 version of graffitiing a bathroom wall, but with more stone-chisel carpal tunnel.",
	"I’m not saying this journey is dangerous, but the local graveyards have a higher population density than the trail itself.",
	"If you find yourself talking to the oxen, that's just a sign of a healthy, functioning pioneer mind. If they start talking back, that's a sign you need to check your food supply for mold.",
	"You’re in the Rocky Mountains! The air is thin, the peaks are sharp, and the probability of a random tragedy is statistically significant.",
	"Remember: if you haven't contracted at least three different varieties of ancient, forgotten diseases by Fort Bridger, are you even really trying?",
	"Bringing a skilled doctor on the trip can provide life-saving care for your party and keep illness at bay. Hopefully your wagon doesn't come across any apples however.",
	"Who needs supplies when a Merchant can trade like none other for whatever you need? Then again, if you had the right supplies to begin with, you wouldn't need to trade.",
	"I won't say anything about Gunsmiths. I don't want them to shoot me, please and thanks.",
	"Jesus was a Carpenter. And you'll need divine luck to repair your wagon and survive the trip.",
	"Some say we're overhunting the livestock and often wasting meat. But fishing allows us to exploit even more ecosystems.",
	"Hunters can help track animals and avoid cold trails. Successfully bringing home meat also helps you avoid the cold shoulder. Or cold rump roast.",
	"A successful farmer would have no reason to leave Missouri. The bad farmers on the trail might be able to calm animals atleast.",
	"Supposedly there is gold out west. But a good prospector can try to find gold in streams along the way if you run out of money.",
	"Tailors keep you in good clothes to deal with all the inclement weather. Yeah, it isn't as sexy as being a great sharpshooter, but it beats freezing to death.",
	"Council Grove is the last place to find decent hardwood. After this, if your axle breaks, you’ll be trying to carve a replacement out of a cactus. Spoiler: it doesn't work.",
    "Bent's Old Fort is an adobe castle in the middle of nowhere. It’s a great place to trade your dignity for a cup of lukewarm water and a 'reclaimed artifact' that looks suspiciously like a rock.",
    "Once you reached Santa Fe, enjoy the spicy food and the booming trade. Just remember, in this economy, a 'Premium Barter' usually just means you overpaid for a donkey.",
    "Turning toward Fort Reno? I hope you brought plenty of bullets. This isn't a 'balanced' gameplay zone; it’s more of a 'survival is a bug, not a feature' zone.",
    "Fort Phil Kearny has the highest wooden stockades I've ever seen. They say it's to keep the Indians out, but I think it's to stop the pioneers from sprinting back to Missouri.",
    "Virginia City! You made it to the Montana gold fields. You're rich! Now, good luck trying to spend that gold in a town where the average life expectancy is measured in minutes.",
    "Salt Lake Valley: 'This is the place!' It’s a beautiful desert that we’re going to turn into a garden through the power of irrigation and sheer, stubborn will. Also, we’re hiring for a new reality show.",
    "The Humboldt River is a lovely stream that tastes exactly like a dusty gym sock. Drink up! It’s the only 'Liquid Asset' you’ll see for three hundred miles.",
    "Donner Pass is beautiful this time of year, provided you don't mind the snow or your family looking at you like you're a giant, walking Salisbury steak.",
    "Sutter's Fort is the end of the line. There’s gold in those hills! Or at least, there’s a guy named Sutter who will charge you $50 for a shovel to go look for it.",
    "If you’re Gathering resources, remember: Punching a cow for steak is perfectly normal video game logic. If you try it in real life, the cow usually wins.",
    "Prospecting is just nature’s way of offering you a lootbox. You spend fifteen seconds panning in a river only to find a 'Common' piece of junk like a Cleveland femur.",
    "Trading in 'Oxen Tycoon' mode is all about arbitrage. If you can't convince a stranger that your crusty sock is worth a wagon wheel, you’re just not using enough corporate jargon.",
    "The 'Number Muncher' lock on your inventions is there to ensure only the most mathematically gifted pioneers can reinvent the wheel. Literally.",
    "I heard the 'Gamer' profession has a 'Lag Shield' on the river. Must be nice to have high-latency protection while your kids are actively drowning in 8-bit water.",
    "If your sanity hits zero, don't worry. The prairie dogs in the next zone are actually very welcoming, though their 'Premium Currency' is mostly just dried grass.",
    "Always check your 'Pity Meter' before a big pull from the river. You wouldn't want to waste your RNG luck on a piece of pyrite when a 'Physical Bitcoin' is on the line.",
    "Why follow the Oregon Trail when you can take the Santa Fe? It’s 1,200 miles shorter, which means 60% less time spent contracting ancient, forgotten social diseases.",
    "Some folks call it 'Save Scumming.' I call it 'Temporal Realignment for the Purpose of Not Dying of a Vorpal Bunny Bite.'",
	"I decided to visit the brothel. Y ou gotta hand it to blind prostitutes.",
];

const TradeClues = {
    "oxen": ["Our lead puller is lookin' mighty thin...", "I'd give my left boot for some more beastly horsepower.", "We're down to two hooves and a prayer."],
    "clothing": ["The mountain chill is bitin' through our shirts.", "We've got more holes than fabric at this point.", "My wife has been reading about fancy new fashions back East."],
    "bullets": ["The wolves are gettin' bold, and our powder is low.", "Hard to hunt when you're clickin' on empty.", "We need some long-range logic for the local predators."],
    "wheels": ["One more rock and that wheel is gonna be a triangle.", "We're rollin' on more prayer than tread at this point.", "Spare wheels are worth more than gold out here."],
    "axles": ["Our axle is held together by spit and a dream.", "That axle's got more cracks than a Kansas drought.", "We're one pothole from walkin' the rest of the way."],
    "tongues": ["The wagon tongue's about to give up the ghost.", "Can't steer worth a darn with a busted tongue.", "Lost our tongue back at the last river crossing. Not the metaphorical kind."],
    "medicine": ["Little Jedediah's got the shakes real bad.", "We need something for the Mad Ox Disease.", "Looking for a bottle of that special Morphine syrup."],
    "food": ["The kids are startin' to look at the dog funny.", "Nothing but salted pork for three weeks...", "Our bellies are as empty as a Kansas prairie."],
    "books": ["The nights are long and there's nothin' to read.", "I'd trade my hat for a good story to pass the time.", "Looking for some mental escape from this mud."],
    "junk": ["My collection is missin' some 'reclaimed artifacts'.", "You got any of those shiny pixel-trinkets?", "I'm a sucker for a good 'World's Okayest Pioneer' mug."],
    "firewood": ["The nights out here get colder than a banker's handshake.", "Can't cook, can't warm the kids, can't do a blessed thing without dry wood.", "Every stick out here's either wet or already claimed."],
    "waterBarrels": ["Our barrels have been bone dry since the last crossing.", "A man can go a long way on hope. Not as far on no water.", "We're rationing drops at this point. Actual drops."],
};

const DEFAULT_SCORES = [
    { name: "R. Philip Bouchard", score: 99999, profession: "Gamer", status: "Coding", date: "08/12/1848" },
    { name: "Baron Von Wagon", score: 10000, profession: "Banker", status: "Rich", date: "05/01/1848" },
    { name: "Jesus", score: 7500, profession: "Carpenter", status: "Risen", date: "04/13/0033" },
    { name: "Kraven", score: 6000, profession: "Hunter", status: "Bloody", date: "06/20/1848" },
    { name: "Lucy Boerin", score: 5000, profession: "Farmer", status: "Trapped", date: "07/04/1848" },
    { name: "Doctor Nick", score: 4000, profession: "Doctor", status: "Hurting", date: "03/15/1848" },
    { name: "Inna Stitch", score: 3000, profession: "Tailor", status: "Suitable", date: "09/10/1848" },
    { name: "Dora the Explorer", score: 2000, profession: "Guide", status: "Lost", date: "02/28/1848" },
    { name: "Elisa Esposito", score: 1000, profession: "Fisherman", status: "Enamored", date: "11/11/1848" },
    { name: "Moe Ron", score: 120, profession: "Prospector", status: "Dead", date: "12/25/1848" }
];

const RouteDistances = {
    "Oregon": 2170,
    "California": 2050,
    "Mormon": 1350,
    "Santa Fe": 900,
    "Bozeman": 1100, // Short but high danger
	"UNO Reverse": 2170 // Now I am just being silly
};

const WATER_PER_BARREL = 20;

const UNO_REVERSE_DISTANCES = {
    "The Dalles": 100, "Blue Mountains": 125, "Fort Boise": 160, "Snake River Crossing": 114,
    "Fort Hall": 182, "Soda Springs": 57, "Green River Crossing": 143, "South Pass": 57,
    "Independence Rock": 102, "Fort Laramie": 190, "Chimney Rock": 86, "Fort Kearney": 250,
    "Big Blue River Crossing": 118, "Kansas River Crossing": 82, "Independence": 102
};

let muncherState = null;

// --- Global State ---
let isNostalgia = false;
let wagon, char1, char2, char3, char4, char5;

// --- Constructors ---

class Character {
    constructor(name, id) {
    this.name = name;
    this.id = id;
    this.health = 100;
    this.status = "Good";
    this.illness = [];
    }

    healthBar() {
        const bar = document.getElementById(`char${this.id}-health-bar`);
        if (!bar) return;
	    
        const pairs = { 
            Good: "#28a745", 
            Fair: "#f0ad4e", 
            Poor: "#d9534f", 
            Dead: "#333333", // Dark grey for dead
            "Mostly Dead": "#880000" 
        };
        
        bar.value = Math.max(0, this.health);
        
        bar.style.width = "100%"; 
        
        const statusColor = pairs[this.status] || "#d9534f";
        bar.style.setProperty('--progress-color', statusColor);
	    
        if (this.health <= 0 || this.status === "Dead") {
            bar.style.filter = "grayscale(100%) brightness(0.5)";
            bar.style.opacity = "0.5"; // Slightly fade it so the living stand out
        } else {
            bar.style.filter = "none";
            bar.style.opacity = "1.0";
        }
    }

    illnessGenerator(wagon) {
        let chance = 2; 
	    const isMedic = hasSkill("Medical");
        if (wagon.pace === "Grueling") chance += 5;
        if (wagon.rations === "Bare Bones") chance += 5;
        if (this.health < 50) chance += 5; // Low health increases risk
        
        // Do you not have adequate clothing for the weather
        const overlay = document.getElementById("weather-overlay");
	    const aliveCount = wagon.characters.length;
        if (!wagon.flags.bigfoot_blanket) { // Bigfoot blanket provides warmth
	        if ((overlay && overlay.style.display === "block") && (wagon.clothing < (aliveCount * 2))) {
                chance += 5; // Increased risk during active weather events
            } else if ((overlay && overlay.style.display === "block") && (wagon.clothing < (aliveCount * 1))) {
                chance += 2; // Increased risk during active weather events
            }
	    }
	    
        const roll = Math.floor(Math.random() * 100);
	    const roll2 = Math.floor(Math.random() * 100);
        
        if (roll < chance) {
	    	if (isMedic && roll2 > 50) {
	    		updateActionPrompt(translateSanity(`Your Medical training kept ${this.name} from getting sick.`));
	    		eventLog.insertAdjacentHTML('afterbegin', `Your Medical training kept ${this.name} from getting sick.<br>`);
	    	} else {
                const randomIllness = ILLNESSES[Math.floor(Math.random() * ILLNESSES.length)];
                const severityRoll = Math.floor(Math.random() * 3) + 1;
                const grades = { 1: "MILD", 2: "MODERATE", 3: "SEVERE" };
                
                if (!this.illness.find(i => i.name === randomIllness.name)) {
                    this.illness.push({ name: randomIllness.name, severity: severityRoll });
                    
                    const log = eventLog;
                    updateActionPrompt(`${this.name} contracted a ${grades[severityRoll]} case of ${randomIllness.name}! Charizard and Chlamydia, Gotta catch 'em all!`);
                    log.insertAdjacentHTML('afterbegin', 
                        `<span style="color:red;">${this.name} contracted a ${grades[severityRoll]} case of ${randomIllness.name}! Charizard and Chlamydia, Gotta catch 'em all!</span><br>`
                    );
                }
	    	}
        }
    }
}

class Wagon {
    constructor() {
    this.difficulty = "Normal";
    this.diffMultiplier = 1.0;
    this.isStuck = false;
    this.brokenPart = null; // Can be 'wheel', 'axle', or 'tongue'
    this.graveyard = [];
	this.isMuted = false;
	this.isNostalgia = false;
	this.year = 1848;
    this.month = "March"; 
    this.day = 1;
    this.food = 0;
    this.money = 0;
    this.days = 0;
    this.characters = [];
    this.oxen = 0;
	this.draftAnimal = "Oxen"; // "Oxen" | "Mules" | "Horses" — set once in finalizeCharacterSetup, locked for the run
	this.oxenHealth = 100;
	this.dogHealth = 100; 
	this.packingModifier = 1.0; // Set by the wagon-packing puzzle; scales effective weight (0.88 great … 1.10 awful)
	this.isPacked = false;
	this.clothing = 0;
	this.bullets = 0;
	this.wheels = 0;
	this.axles = 0;
	this.tongues = 0;
	this.medicine = 0;
	this.books = 0;
	this.junk = 0;
	this.firewood = 0; // Bundles of firewood: 1 burned per night, +1 resting, +1 cold
	this.waterBarrels = 0; // Barrel containers; each holds WATER_PER_BARREL person-days
	this.water = 0; // Current person-days of drinking water stored across all barrels
    this.distance = 0;
    this.hunted = 0;
    this.completed = 0.01;
    this.currentLandmark = "Independence";
	this.nextLandmark = null;
	this.pathHistory = ["Independence"];
	this.currentZone = 1;
    this.milesToNextLandmark = Landmarks["Independence"].distanceToNext[0];
	this.isStationaryAtStart = true;
    this.totalDistance = 0;
	this.weatherMultiplier = 1.0;
	this.paceMultiplier = 1.0;
	this.sanity = 100;
	// Hidden karma tally. Never rendered anywhere, never mentioned to the player. Nudged by choices throughout the trail; a handful of
    // rare outcomes check it at the extremes. Clamped to [-100, 100] by adjustKarma().
	this.karma = 0;
	this.flags = {};

    this.pace = "Steady"; // Steady (15mi), Strenuous (20mi), Grueling (30mi)
    this.rations = "Filling"; // Filling (3 lb/person), Meager (2 lb), Bare Bones (1 lb)
	
	this.huntState = {
        animal: null,
        hp: 0,
        distance: "long", // "long" or "close"
        turnsRemaining: 3,
        isCharging: false,
		message: "You find tracks in the area."
    };

    this.gatheringState = null;
    this.resources = {
        "Block of Wood": 0,
        "Square Cow": 0,
        "Glitched Cobblestone": 0,
		"Medicinal Plants": 0
    };
	
    this.prospectingState = {
        pityMeter: 0,
        timer: 15, // 15 seconds of active panning
        isProcessing: false,
        goldClicked: 0
    };
	
    this.tradeState = {
        npcName: "",
        desireCategory: "", 
        offersMade: 0,
        maxOffers: 3,
        npcInventory: []
    };
	
    this.raftState = {
        distance: 0,
        target: 1500, // Distance to Willamette Valley
        health: 3,
        isProcessing: false,
        obstacles: [],
        speed: 8,
        lastSpawn: 0,
		controlsInverted: false,
    };

    this.dailyChallenge = null;
    // Which mutator challenge this run uses ('winter', 'ghost', ...), or
    // null for a standard run. Drives rule tweaks and leaderboard routing.
    this.challengeMode = null;
    // Per-day distance log; every run records one (it becomes a ghost if
    // the run finishes). In Ghost Race mode, ghostRace holds the phantom
    // being raced: { route, days, name, log }.
    this.ghostLog = [0];
    this.ghostRace = null;

    // Seeded RNG state for saloon gambling. Persisted in the save file so
    // that reloading an old save and replaying the same bets always deals
    // the same cards/dice — no free re-rolls via save-scumming.
    this.gamblingSeed = null;
    // Transient table state for whatever hand/round is currently in progress.
    // Never itself persisted long-term (stripped out on save, same as
    // raftState.obstacles) — only its side effects (money, karma, the seed)
    // stick around.
    this.saloonState = null;
    }

    resourceChecker() {
    if (this.food <= 0) {
        this.food = 0;
		for (let i = 0; i < this.characters.length; i++) {
            let char = this.characters[i];
            if (char.status === "Dead") continue;

			char.health = Math.max(0, char.health - 10);
            if (char.health <= 0) {
                this.killCharacter(i, "Starvation");
            }
		}
    }
    if (this.bullets <= 0) this.bullets = 0;
    }

    // --- Wagon weight (background stat, no UI) -------------------------------
    // Everything aboard, in 1848-flavored pounds. People and the dog walk.
    getWagonWeight() {
    const w =
        (this.food || 0) * 1 +            // food is already in lbs
        (this.bullets || 0) * 0.05 +      // ~1 lb per box of 20
        (this.clothing || 0) * 5 +
        (this.wheels || 0) * 40 +
        (this.axles || 0) * 30 +
        (this.tongues || 0) * 25 +
        (this.medicine || 0) * 1 +
        (this.books || 0) * 3 +
        (this.junk || 0) * 10 +
        (this.firewood || 0) * 15 +
        (this.water || 0) * 4 +           // ~half gallon per person-day drink
        (this.waterBarrels || 0) * 30;    // the barrels themselves
    const res = this.resources || {};
    return Math.round(w +
        (res["Block of Wood"] || 0) * 20 +
        (res["Square Cow"] || 0) * 50 +
        (res["Glitched Cobblestone"] || 0) * 30 +
        (res["Medicinal Plants"] || 0) * 1);
    }

    getPullingCapacity() {
    const perAnimal = getDraftAnimalConfig(this.draftAnimal).pullPerAnimal;
    return Math.max(1, (this.oxen || 0) * perAnimal);
    }

    // Raw weight scaled by packing quality (wagon-packing puzzle). A tight pack (0.88) pulls
	// like 12% less of itself; a loose pile (1.10)	shifts and drags.
    getEffectiveWeight() {
    return Math.round(this.getWagonWeight() * (this.packingModifier || 1.0));
    }

    // 1.0 = at capacity. Above 1.0 the team is straining.
    getLoadRatio() {
    return this.getEffectiveWeight() / this.getPullingCapacity();
    }

    // Plural/singular display names for whichever draft animal this run locked
    // in — "Oxen"/"oxen"/"ox", "Mules"/"mules"/"mule", "Horses"/"horses"/"horse".
    animalPluralCap() { return getDraftAnimalConfig(this.draftAnimal).Plural; }
    animalPlural() { return getDraftAnimalConfig(this.draftAnimal).plural; }
    animalSingular() { return getDraftAnimalConfig(this.draftAnimal).singular; }

    weightWarningText() {
    const ratio = this.getLoadRatio();
    if (ratio <= 1.0) return "";
    const weight = this.getEffectiveWeight();
    const capacity = this.getPullingCapacity();
    const pct = Math.round((ratio - 1) * 100);
    const perAnimal = getDraftAnimalConfig(this.draftAnimal).pullPerAnimal;
    const oxenNeeded = Math.ceil(weight / perAnimal) - this.oxen;
    const packNote = (this.packingModifier || 1.0) > 1.0
        ? ` A tighter re-pack of the wagon bed would also help — half this mess is air.`
        : '';
    return `Your wagon is hauling an effective ${weight} lbs but your ${this.oxen} oxen can only comfortably pull ${capacity} lbs (${pct}% overloaded). ` +
        `The team will slow down and tire faster. Consider buying ${oxenNeeded} more ox${oxenNeeded === 1 ? '' : 'en'} — or eating your way to a lighter wagon.${packNote}`;
    }

    // Nightly campfire resolution. Needs 1 bundle per night, +1 if resting (longer
    // camp), +1 on a cold day. Returns one of:
    //   'fire'        — full fire: small morale benefit (and healing while resting)
    //   'meager_fire' — some wood but not enough: no bonus, no penalty
    //   'prompt_book' — no wood but books available: caller should offer to burn one
    //   'fireless'    — no wood, no books: fireless-night consequences already applied
    processCampfire(isResting) {
    const isCold = (this.currentTemp !== undefined && this.currentTemp <= 40);
    const needed = 1 + (isResting ? 1 : 0) + (isCold ? 1 : 0);

    if (this.firewood >= needed) {
        this.firewood -= needed;
        // A proper fire keeps spirits (and cooking) up
        this.sanity = Math.min(100, this.sanity + 1);
        if (isResting) {
            this.characters.forEach(c => {
                if (c.status !== "Dead") c.health = Math.min(100, c.health + 1);
            });
        }
        if (Math.random() < 0.2) {
            const cozyLines = [
                "The campfire crackles pleasantly. For a moment, the trail doesn't seem so bad.",
                "Beans cooked over a real fire. Living the 1848 dream.",
                "The fire keeps the darkness (and your intrusive thoughts) at bay.",
            ];
            const line = cozyLines[Math.floor(Math.random() * cozyLines.length)];
            eventLog.insertAdjacentHTML('afterbegin', `${line}<br>`);
        }
        return 'fire';
    }

    if (this.firewood > 0) {
        // Not enough for a proper fire — burn what's left. No bonus, but the small
        // flame is enough to avoid the dangers of a truly dark camp.
        this.firewood = 0;
        eventLog.insertAdjacentHTML('afterbegin', `You burn the last of your firewood. The fire is pitiful, but it's a fire.<br>`);
        return 'meager_fire';
    }

    if (this.books > 0) {
        // Caller decides how/when to show the burn-a-book choice (modal timing varies)
        this.flags.pendingBookBurn = true;
        return 'prompt_book';
    }

    this.firelessNight();
    return 'fireless';
    }

    // A night without any fire: always a little misery, sometimes something worse.
    firelessNight() {
    this.sanity = Math.max(0, this.sanity - 1);

    if (Math.random() >= 0.35) {
        if (Math.random() < 0.3) {
            eventLog.insertAdjacentHTML('afterbegin', `A cold, dark, fireless camp. Everyone sleeps poorly.<br>`);
        }
        return;
    }

    const roll = Math.random();
    let msg = "";
    if (roll < 0.40) {
        // Thieves — a dark camp is an easy target, unless someone furry is on watch
        if (this.flags && this.flags.has_dog && this.dogHealth > 20 && Math.random() < 0.5) {
            const dName = this.flags.dog_name || "Buster";
            msg = `Thieves crept toward your fireless camp — but ${dName} heard them long before you would have. One warning growl in the pitch dark and they decided your camp wasn't worth it.`;
            AudioManager.playSound('woof');
        } else {
            const stolenFood = Math.min(this.food, Math.floor(Math.random() * 21) + 10);
            const stolenBullets = Math.min(this.bullets, Math.floor(Math.random() * 11) + 5);
            this.food = Math.max(0, this.food - stolenFood);
            this.bullets = Math.max(0, this.bullets - stolenBullets);
            msg = `Thieves crept through your fireless, pitch-black camp! They took ${stolenFood} lbs of food and ${stolenBullets} bullets. A campfire might have scared them off.`;
            AudioManager.playSound('alert');
        }
    } else if (roll < 0.70) {
        // Uncooked food — nothing to cook over
        const living = this.characters.filter(c => c.status !== "Dead");
        if (living.length > 0) {
            const victim = living[Math.floor(Math.random() * living.length)];
            victim.health = Math.max(0, victim.health - 8);
            msg = `With no fire to cook over, ${victim.name} ate questionable raw bacon and spent the night regretting every decision that led to this moment. They also can't stop shitting. (-8 Health)`;
        }
    } else {
        // Things that go bump in the dark
        this.sanity = Math.max(0, this.sanity - 5);
        msg = `Strange noises circled the camp all night. Without firelight, every snapped twig sounded like Bigfoot. Or worse: a tax collector. (-5 Sanity)`;
        AudioManager.playSound('spooky');
    }

    if (msg) {
        eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#f0ad4e;">${msg}</span><br>`);
        updateActionPrompt(translateSanity(msg));
    }
    }

    // Daily water cycle: capture first (rain / Survival-skill stream finds), then drink.
    // Consumption is 1 person-day per living member, doubled in desert zones. Anyone
    // with nothing to drink loses 15 health — at perfect health that's ~7 days to death.
    processWater() {
    const living = this.characters.filter(c => c.status !== "Dead");
    if (living.length === 0) return;

    const capacity = this.waterBarrels * WATER_PER_BARREL;
    const zone = Zones[this.currentZone];
    const inDesert = zone && zone.terrain === "desert";

    // --- Capture: rain barrels catch precipitation if there's room ---
    if (this.waterBarrels > 0 && this.water < capacity) {
        if (this.hasWater) { // precipitation rolled by calculateEnvironment today
            let caught = Math.floor(Math.random() * 4) + 3; // 3–6 person-days
            if (hasSkill("Survival")) caught += 2; // rigged tarps funnel more into the barrels
            const before = this.water;
            this.water = Math.min(capacity, this.water + caught);
            if (this.water > before && Math.random() < 0.5) {
                eventLog.insertAdjacentHTML('afterbegin', `Rain drums on the barrel lids. You caught ${(this.water - before).toFixed(0)} drinks' worth of free sky water.<br>`);
            }
        } else if (hasSkill("Survival") && Math.random() < 0.25) {
            // Survival skill: spot a stream/seep off-trail even on dry days
            const before = this.water;
            this.water = Math.min(capacity, this.water + 3);
            if (this.water > before) {
                eventLog.insertAdjacentHTML('afterbegin', `Your Survival skill led you to a hidden stream. +${(this.water - before).toFixed(0)} water.<br>`);
            }
        }
    }

    // --- Consumption ---
    const rationsWaterMult = { "Filling": 1.2, "Meager": 1.0, "Bare Bones": 0.8 }[this.rations] || 1.0;
    const perPerson = (inDesert ? 2 : 1) * rationsWaterMult;
    const demand = living.length * perPerson;

    if (this.water >= demand) {
        this.water -= demand;
        if (inDesert && Math.random() < 0.25) {
            eventLog.insertAdjacentHTML('afterbegin', `The desert heat is brutal. Everyone is drinking double.<br>`);
        }
        return;
    }

    // Not enough for everyone: whatever remains covers some people; the rest go dry.
    const served = Math.floor(this.water / perPerson);
    const parched = living.length - served;
    this.water = Math.max(0, this.water - served * perPerson);

    // Mules shrug off a dry stretch much better than oxen or horses —
    // half the usual dehydration bite (see DRAFT_ANIMALS.lowWaterHealthMult).
    const dehydrationPenalty = Math.round(15 * getDraftAnimalConfig(this.draftAnimal).lowWaterHealthMult);

    for (let i = this.characters.length - 1; i >= 0; i--) {
        const char = this.characters[i];
        if (char.status === "Dead") continue;
        // The first `served` living members drank; the rest take dehydration damage.
        // Distribute dry days across the roster back-to-front so it isn't always dad.
        if (parched > 0 && (i % living.length) < parched) {
            char.health = Math.max(0, char.health - dehydrationPenalty);
            if (char.health <= 0) {
                this.killCharacter(i, "Dehydration");
            }
        }
    }

    const dryMsg = (this.waterBarrels === 0)
        ? `You have no water barrels! ${parched} member${parched === 1 ? '' : 's'} of your party went thirsty today. (-${dehydrationPenalty} Health)`
        : `The water barrels are empty! ${parched} member${parched === 1 ? '' : 's'} of your party went thirsty today. (-${dehydrationPenalty} Health)`;
    eventLog.insertAdjacentHTML('afterbegin', `<span style="color:red;">${dryMsg}</span><br>`);
    updateActionPrompt(translateSanity(dryMsg));
    }

    statusAdjuster() {
        this.characters.forEach((char, index) => {
            // If they are already dead, skip all health/status logic
            if (char.status === "Dead" || char.health <= 0) {
                char.health = 0;
                char.status = "Dead";
                return; 
            }
	    
            let currentCause = "General Exhaustion";
            if (char.illness.length > 0) {
                currentCause = `Complications from ${char.illness[0].name}`;
            } else if (this.food <= 0) {
                currentCause = "Starvation";
            }
	    
            // Process illness only for the living
            if (char.illness.length > 0) {
                char.illness.forEach(ill => {
                    let impact = (ill.severity === 3) ? 3 : (ill.severity === 1 ? 1 : 2);
	    			char.health = Math.max(0, char.health - impact);
                });
            }
	    
            // Status thresholds
            if (char.health >= 80) char.status = "Good";
            else if (char.health >= 40) char.status = "Fair";
            else if (char.health > 5) char.status = "Poor";
            else char.status = "Mostly Dead";
	    	
	    	if (typeof char.healthBar === "function") char.healthBar();
	    
            if (char.health <= 0) {
                this.killCharacter(index, currentCause);
            }
        });
    }

    killCharacter(index, cause = "Unknown Causes") {
    const char = this.characters[index];
    if (!char || char.status === "Dead") return;

    char.health = 0;
    char.status = "Dead";
    char.isDead = true;
    char.causeOfDeath = cause;
	
    if (typeof char.healthBar === "function") {
        char.healthBar(); 
    }

    const isGamer = (this.professionName === "Gamer");
    let deathMsg = "";

    if (isGamer) {
        const gamerDeaths = [
            `Error 404: ${char.name} not found.`,
            `${char.name} has been kicked from the server.`,
            `FATAL ERROR: ${char.name} process terminated.`,
			`The Admins banned ${char.name} from life.`,
			`${char.name} must be playing Dark Souls because they died.`,
			`${char.name} lost a life and I am not seeing a 1-Up mushroom anywhere.`,
			`${char.name} is looking at a personal, permanent game-over screen.`,
			`${char.name} did not insert another quarter to continue.`,
			`${char.name} hit Alt-F4 on life.`,
        ];
        deathMsg = gamerDeaths[Math.floor(Math.random() * gamerDeaths.length)];
    } else {
        deathMsg = `${char.name} has died of ${cause}.`;
    }

    // Handle Ghost Visuals
    if (this.flags.ghost_protection) {
        deathMsg += " The Ghost of '47 guides their soul.";
        if (typeof showGhost === "function") {
            showGhost();
        } else if (wagon && typeof wagon.showGhost === "function") {
            wagon.showGhost(); 
        }
    }

    // Log the event
    eventLog.insertAdjacentHTML('afterbegin', 
        `<span style="color:black; font-weight:bold;">${deathMsg}</span><br>`
    );

    // Record for Graveyard
    wagon.graveyard.push({ 
        name: char.name, 
        cause: cause, 
        date: `${this.month} ${this.day}, ${this.year}`, 
        location: Landmarks[this.currentLandmark]?.name ?? this.currentLandmark
    });

    if (typeof textUpdateUI === "function") {
        textUpdateUI(); // If it's a global function
    } else if (wagon && typeof wagon.textUpdateUI === "function") {
        wagon.textUpdateUI(); // If it's a prototype method
    }

    if (this.characters.every(c => c.status === "Dead")) {
        AchievementManager.unlock('dead', 'Unalived');
		buildEndModal("dead", "death", "Rethink Your Life");
        toggleDisplay("#myModal");
    } else {
        if (typeof showGhost === "function") {
            showGhost();
        } else if (wagon && typeof wagon.showGhost === "function") {
            wagon.showGhost(); 
        }
	}
    }

    turn() {
    if (this.isStuck) {
        AudioManager.playSound('alert');
        updateActionPrompt(translateSanity(`CRITICAL ERROR: Your wagon is missing a ${this.brokenPart}. You aren't going anywhere without it.`));
		eventLog.insertAdjacentHTML('afterbegin', `CRITICAL ERROR: Your wagon is missing a ${this.brokenPart}. You aren't going anywhere without it.<br>`);
        shakeElement('wagon-body');
        return;
    }
    if (!wagon.flags) wagon.flags = {};

    if (this.draftAnimal === "Mechanical Bull" && !this.flags.bullRodeoDone) {
        this.flags.bullRodeoDone = true;
        showMechanicalBullModal();
        return;
    }

	this.flags.hasMournedThisStop = false;
	this.days += 1;
    this.advanceDay();

    // Ghost recording: one distance sample per day, for every run. Cheap insurance — any finished run can become a ghost to race later.
    // The while (not a single push) matters: events that cost extra days thieves, storms) bump this.days without a turn, and the log must
    // stay indexed as ghostLog[day] = distance or the phantom-gap readout drifts. Padding with the current distance self-heals any jump.
    if (!Array.isArray(this.ghostLog)) this.ghostLog = [0];
    while (this.ghostLog.length <= this.days) {
        this.ghostLog.push(Math.round(this.totalDistance));
    }

    // Ghost Race: report the phantom's position each morning.
    if (this.challengeMode === 'ghost' && this.ghostRace && this.ghostRace.log) {
        const g = this.ghostRace;
        const gPos = g.log[Math.min(this.days, g.log.length - 1)];
        const gap = Math.round(gPos - this.totalDistance);
        if (this.days >= g.days && !this.flags.ghostFinished) {
            this.flags.ghostFinished = true;
            eventLog.insertAdjacentHTML('afterbegin',
                `<span style="color:#9be7ff;">👻 ${g.name}'s phantom wagon has reached the end of the trail. The race is lost — but the trail isn't.</span><br>`);
        } else if (!this.flags.ghostFinished) {
            const gapMsg = gap > 0
                ? `👻 The phantom wagon is ${gap} miles ahead.`
                : (gap < 0 ? `👻 You lead the phantom wagon by ${-gap} miles.` : `👻 You are neck and neck with the phantom wagon.`);
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#9be7ff;">${gapMsg}</span><br>`);
        }
    }

	this.weatherMultiplier = 1.0;
    
    const zone = Zones[this.currentZone];
    
    if (Math.random() < 0.1) { 
        this.triggerWeather(zone.weatherRisk);
    }
    
    const ground = document.getElementById('layer-ground');
    if (zone.terrain === "desert") ground.style.backgroundColor = "#D2B48C"; // Tan
    else if (zone.terrain === "prairie") ground.style.backgroundColor = "#228B22"; // Green
    
	let basePace = Math.floor(Math.random() * (18 - 12 + 1)) + 12;
	let paceMultiplier = 1.0;
    if (this.pace === "Strenuous") paceMultiplier = 1.5;
    if (this.pace === "Grueling") paceMultiplier = 2.0;
    let teamModifier = 1.0;
    if (this.oxen < 2) {
        // Game Over condition
        AchievementManager.unlock('dead', 'Unalived');
		buildEndModal("dead", "death", "Rethink Your Life");
        document.querySelector(".button-content").insertAdjacentHTML('afterbegin', "Game Over! You have too few oxen to continue.");
        toggleDisplay("#myModal");
        return;
    } else if (this.oxen < 6) {
        teamModifier = 0.7; // Slowed due to small team
    } else if (this.oxen > 8) {
        teamModifier = 1.1; // Slightly faster for a large team
    }
    let healthPenalty = (this.oxenHealth < 50) ? 0.5 : 1.0; 
    const animalCfg = getDraftAnimalConfig(this.draftAnimal);
    let travelDistance = (basePace * paceMultiplier * healthPenalty * teamModifier * this.weatherMultiplier * animalCfg.paceModifier);
	travelDistance = travelDistance * (this.diffMultiplier || 1.0);

    let animalsBalked = false;
    if (animalCfg.stubbornChance > 0 && this.oxen > 0) {
        let stubbornChance = animalCfg.stubbornChance;
        if (hasSkill("Animal Handling")) stubbornChance *= 0.4;
        if (Math.random() < stubbornChance) {
            animalsBalked = true;
            travelDistance = 0;
        }
    }

    // Wagon weight (background stat): an overloaded team travels slower and tires. At capacity or under: full speed. 20% over: 90% speed. 100%+ over: floor of 50%.
    const loadRatio = this.getLoadRatio();
    if (loadRatio > 1.0) {
        const weightFactor = Math.max(0.5, 1 - (loadRatio - 1) * 0.5);
        travelDistance *= weightFactor;

        // Straining oxen fatigue faster: up to -5 health/day at double capacity.
        // Animal Handling halves the strain, consistent with the daily formula.
        let strain = Math.min(5, (loadRatio - 1) * 5);
        if (hasSkill("Animal Handling")) strain *= 0.5;
        this.oxenHealth = Math.max(0, this.oxenHealth - strain);

        if (Math.random() < 0.15) {
            const strainMsg = `The oxen strain against the overloaded wagon, breathing hard. They could use more teammates — or less cargo.`;
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#f0ad4e;">${strainMsg}</span><br>`);
        }
    }

    if (animalsBalked) {
        const stubbornMsg = `Your oxen have made an executive decision: today, nobody goes anywhere. Every rope, treat, and stern word fails.`;
        updateActionPrompt(translateSanity(stubbornMsg));
        eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#f0ad4e;">${stubbornMsg}</span><br>`);
    }

	this.weatherMultiplier = 1.0;
	
	// Map Rations to food consumption
    const rationMap = { "Filling": 3, "Meager": 2, "Bare Bones": 1 };
    let foodPerPerson = rationMap[this.rations];

    this.calculateEnvironment();
	this.updateGroundVisuals();   
    this.processWater();

	this.milesToNextLandmark = Math.max(0, this.milesToNextLandmark - travelDistance);
    this.totalDistance += travelDistance;

    // Grueling Pace Penalties
    if (this.pace === "Grueling") {
        for (let i = 0; i < this.characters.length; i++) {
            let char = this.characters[i];
            if (char.status === "Dead") continue;
    
			char.health = Math.max(0, char.health - 2);
            if (char.health <= 0) {
                this.killCharacter(i, "Exhaustion (Grueling Pace)");
            }
        }
        this.sanity = Math.max(0, this.sanity - (Math.random() * 1 + 1));
    }
    
    // Bare Bones Rations Penalties
    if (this.rations === "Bare Bones") {
        for (let i = 0; i < this.characters.length; i++) {
            let char = this.characters[i];
            if (char.status === "Dead") continue;
    
			char.health = Math.max(0, char.health - 1);
            if (char.health <= 0) {
                this.killCharacter(i, "Malnutrition (Starvation)");
            }
        }
        this.sanity = Math.max(0, this.sanity - (Math.random() * 1 + 1));
    }
    
    if (this.food > 0) {
		const dogShare = (this.flags && this.flags.has_dog) ? 1 : 0; // the dog eats too
		this.food = Math.max(0, this.food - (this.characters.length * foodPerPerson) - dogShare);
    } else {
        this.food = 0;
    }

    // We scroll the background image to simulate movement
    const bgLayer = document.getElementById('layer-background');
    if (bgLayer) {
        let scrollPos = (this.totalDistance * 5) % 2048;
        bgLayer.style.backgroundPositionX = `${scrollPos}px`;
    }

    // Animate Landmark Approach
    const landmarkLayer = document.getElementById('layer-landmark');
    const landmarkImg = document.getElementById('landmark-graphic');
    const currentLandmarkData = Landmarks[this.currentLandmark];
    
    if (landmarkLayer && landmarkImg && this.nextLandmark) {
        // Clear mapping layout pointers directly to our active target destination node
        landmarkImg.src = getImagePath(`./img/landmarks/${Landmarks[this.nextLandmark].num}.png`);
    
        let position = 95; 
        if (this.milesToNextLandmark <= 0) {
            position = 95; 
        } else {
            const currentLocData = Landmarks[this.currentLandmark];
            const distIndex = currentLocData.next.indexOf(this.nextLandmark);
            const totalLegDist = currentLocData.distanceToNext[distIndex >= 0 ? distIndex : 0] || 1;
            
            if (this.milesToNextLandmark < totalLegDist * 0.95) {
                const pctRemaining = this.milesToNextLandmark / totalLegDist;
                position = 95 - (pctRemaining * 100);
            } else {
                position = -10;
            }
        }
        landmarkLayer.style.left = `${position}%`;
        
        const isFar = (this.milesToNextLandmark > 60);
        const isStart = (wagon.totalDistance === 0);
        
        landmarkImg.style.display = (isFar && !isStart) ? 'none' : 'block';
        landmarkLayer.style.display = 'flex';
		
		if (this.totalDistance < 5 && this.currentLandmark === "Independence") {
            position = 95; 
            landmarkImg.src = getImagePath(`./img/landmarks/1.png`);
        }
    }

    if (wagon.currentZone !== Landmarks[wagon.currentLandmark].zone) {
        wagon.currentZone = Landmarks[wagon.currentLandmark].zone;
        updateZoneBackground(wagon.currentZone);
		AudioManager.playZoneBGM(wagon.currentZone);
    }
	
    if (hasSkill("Sewing") && this.challengeMode !== 'nudist' && this.clothing < (this.characters.length * 2)) {
        this.clothing++;
        updateActionPrompt(translateSanity("Your Sewing skill allowed you to patch up some rags into a fresh set of clothes."));
		eventLog.insertAdjacentHTML('afterbegin', `Your Sewing skill allowed you to patch up some rags into a fresh set of clothes.<br>`);
    }
    
    if (this.sanity < 15 && !this.flags.glitch && this.totalDistance > 500) {
        this.triggerGlitchInTheWoods();
    }
	
    if (wagon.totalDistance >= 850 && wagon.totalDistance <= 950 && wagon.flags.masonic_handshake) {
        reachSecretLandmark("Grand Lodge of the Rockies");
    }

    // Standard maintenance and Update UI Progress Bar
    this.hunted = 0;
    this.characters.forEach(char => char.illnessGenerator(this));
    this.statusAdjuster();

    if (this.characters.length === 0) {
        AchievementManager.unlock('dead', 'Unalived');
		this.triggerGameOver("death");
		return;
    } else if (this.oxen < 2) {
        AchievementManager.unlock('stranded', 'Stranded');
		this.triggerGameOver("oxen");
		return;
    } else if (this.sanity <= 0) {
        AchievementManager.unlock('insanity', 'Sanity is Overrated');
		this.triggerGameOver("insanity");
		return;
    }
	
    // Arrive at Landmark Check
    if (this.milesToNextLandmark <= 0) {
        this.milesToNextLandmark = 0;
        // No campfire logic on arrival nights — you shelter near the settlement
        this.arriveAtLandmark();
    } else {
        const campStatus = this.processCampfire(false);
        if (campStatus === 'prompt_book') {
            triggerBurnBookEvent();
        } else {
            this.eventGrabber();
        }
	}
    updateJourneyProgress(); 
    this.resourceChecker();
	textUpdateUI();
	updateZoneBackground(this.currentZone);
    }

    triggerGameOver(reason) {
        AudioManager.playSound('gameover');
        const content = modalChild;
        
        let snark = "";
        if (reason === "death") {
            AchievementManager.unlock('dead', 'Unalived');
	    	snark = "Everyone is dead. On the bright side, you no longer have to worry about rations.";
	    	buildEndModal("dead", "death", "Rethink Your Life");
        } else if (reason === "oxen") {
            AchievementManager.unlock('stranded', 'Stranded');snark = "You have fewer than two oxen. Unless you plan on pulling this wagon yourself, your journey is over.";
	    	buildEndModal("oxen", "death", "Rethink Your Life");
        } else if (reason === "insanity") {
            AchievementManager.unlock('insanity', 'Sanity is Overrated');
	    	snark = "Your sanity has hit zero. You've abandoned the wagon to live among the prairie dogs. They have a better dental plan anyway.";
	    	buildEndModal("insanity", "death", "Rethink Your Life");
        }
        
        // Inject the specific snarky message
        const popupText = document.getElementById("popup-text");
        if (popupText) {
            popupText.insertAdjacentHTML('afterbegin', `<p>${snark}</p>`);
        }
    }

    arriveAtLandmark() {
        if (DEBUG) console.log(`%c[TRAIL ENCOUNTERS] Arrived at destination vector! Route: ${this.route} | Target was: ${this.nextLandmark}`, "color: #00ffff; font-weight: bold;");
	    
	    if (!this.nextLandmark) return; // No destination queued — wait for player to choose
        this.currentLandmark = this.nextLandmark;
        const loc = Landmarks[this.currentLandmark];
	    
        if (DEBUG) console.log(`%c[LANDMARK ENTRY] Reached: "${loc.name}" | Type Tag: "${loc.type}"`, "color: #00ff00; font-weight: bold;");
	    
        if (!this.pathHistory.includes(this.currentLandmark)) {
            this.pathHistory.push(this.currentLandmark);
        }
	    
	    if (this.route === "Random" || this.route === "Ironman") {
            if (DEBUG) console.log(`%c[RANDOM ROUTE PROGRESS] Visited: ${this.pathHistory.length} / 25 nodes`, "color: #ff00ff;");
            // Open the landmark UI modal screen normally
            triggerLandmarkUI(this.currentLandmark);
	    
            // Only trigger the 25-stop win cap if explicitly playing Random mode
            if (this.route === "Random" && this.pathHistory.length >= 25) {
                this.nextLandmark = null;
                this.milesToNextLandmark = 0;
                updateActionPrompt("You have reached the 25th and final anomaly! Continue forward to face the music!");
                return;
            }
	    
            // Ironman Mode continues processing past 25 entries safely
            const allKeys = Object.keys(Landmarks);
            const unvisitedKeys = allKeys.filter(key => !this.pathHistory.includes(key));
	    
            // CRITICAL FALLBACK: If Ironman mode exhausts all 35 unique maps, recycle visited hubs
            const finalSelectionPool = unvisitedKeys.length > 0 
                ? unvisitedKeys 
                : allKeys.filter(key => key !== this.currentLandmark);
	    
            this.nextLandmark = finalSelectionPool[Math.floor(Math.random() * finalSelectionPool.length)];
            this.milesToNextLandmark = Math.floor(Math.random() * 201) + 50; 
            
            if (this.route === "Ironman") {
                updateActionPrompt(`Node complete! Anomaly Odometer: ${this.pathHistory.length} stops reached.`);
            }
            return;
        }
	    
	    if (!isGameStarting) {
            const isReverseGoal = (this.route === "UNO Reverse" && this.currentLandmark === "Independence");
            const isStandardGoal = (loc.type === "end" && this.route !== "UNO Reverse" && this.route !== "Random" && this.route !== "Ironman");
	    
            if (isReverseGoal || isStandardGoal) {
                finalizeJourney(true);
                return;
            }
        }
	    
	    triggerLandmarkUI(this.currentLandmark);
	    
        let nextOptions = (typeof loc.getNext === 'function') ? [loc.getNext(this.route)] : loc.next;
        
        if (DEBUG) console.log(`%c[PATH ANALYSIS] Next milestone vectors available from here:`, "color: #ffff00;", nextOptions);
	    
	    if (nextOptions.length === 0 || nextOptions[0] === null) {
            this.nextLandmark = null;
            this.milesToNextLandmark = 0;
        } else if (nextOptions.length === 1) {
            this.nextLandmark = nextOptions[0];
            
            // Explicit layout lookup array to match proper mathematical distances going backward
            if (this.route === "UNO Reverse") {
                this.milesToNextLandmark = UNO_REVERSE_DISTANCES[this.nextLandmark] || 100;
            } else {
                const distIndex = loc.next.indexOf(this.nextLandmark);
                this.milesToNextLandmark = loc.distanceToNext[distIndex >= 0 ? distIndex : 0];
            }
        } else {
            this.nextPlannedStop = null;
            this.nextLandmark = null;
            this.milesToNextLandmark = 0;
        }
    }

    spendPreparationDay() {
        if (!this.flags) this.flags = {};
        this.flags.hasMournedThisStop = false;
        this.days += 1;
        this.advanceDay();

        if (!Array.isArray(this.ghostLog)) this.ghostLog = [0];
        while (this.ghostLog.length <= this.days) {
            this.ghostLog.push(Math.round(this.totalDistance));
        }

        this.weatherMultiplier = 1.0;
        const rationMap = { "Filling": 3, "Meager": 2, "Bare Bones": 1 };
        const foodPerPerson = rationMap[this.rations] || 2;

        this.calculateEnvironment();
        this.updateGroundVisuals();
        this.processWater();

        if (this.pace === "Grueling") {
            for (let i = 0; i < this.characters.length; i++) {
                const char = this.characters[i];
                if (char.status === "Dead") continue;
                char.health = Math.max(0, char.health - 2);
                if (char.health <= 0) this.killCharacter(i, "Exhaustion (Grueling Pace)");
            }
            this.sanity = Math.max(0, this.sanity - (Math.random() * 1 + 1));
        }
        if (this.rations === "Bare Bones") {
            for (let i = 0; i < this.characters.length; i++) {
                const char = this.characters[i];
                if (char.status === "Dead") continue;
                char.health = Math.max(0, char.health - 1);
                if (char.health <= 0) this.killCharacter(i, "Malnutrition (Starvation)");
            }
            this.sanity = Math.max(0, this.sanity - (Math.random() * 1 + 1));
        }

        if (this.food > 0) {
            const dogShare = (this.flags && this.flags.has_dog) ? 1 : 0;
            this.food = Math.max(0, this.food - (this.characters.length * foodPerPerson) - dogShare);
        } else {
            this.food = 0;
        }

        this.eventGrabber();
    }

    rest() {
        if (!this.flags) {
            this.flags = {};
        }
        this.flags.hasMournedThisStop = false;
	    const isMedic = hasSkill("Medical"); //
        const recoveryBonus = isMedic ? 2 : 1; //
        let illnessHealChance = isMedic ? 0.80 : 0.50; //
        if (this.flags.checkupUntilDay && this.days <= this.flags.checkupUntilDay) {
            illnessHealChance = Math.min(0.95, illnessHealChance + (this.flags.checkupStrength || 0));
        }
        const aliveCount = this.characters.length;
        let sanityGained = aliveCount * 1; // 1 per person
	    
        this.campfireResult = this.processCampfire(true);
	    let followUp = "";
        
        // Book Bonus: 2 bonus sanity per day per book-to-member ratio
        if (this.books > 0 && aliveCount > 0) {
            const bookRatio = Math.ceil(this.books / aliveCount);
            sanityGained += (bookRatio * 2);
        }
        
        this.sanity = Math.min(100, this.sanity + sanityGained);
	    
	    let msg = `Rest might be just what the doctor orders.`;
        if (isMedic) {
            msg += " Your medical experience certainly helps.";
	    } else {
	    	msg += " Too bad there is no doctor around.";
	    }
	    
        this.characters.forEach(char => {
	    	if (char.illness.length > 0) {
	    		// Iterate backwards so splicing doesn't shift unvisited elements
	    		for (let i = char.illness.length - 1; i >= 0; i--) {
	    			const ill = char.illness[i];
	    			if (Math.random() < illnessHealChance) {
	    				if (ill.severity < 2) {
	    					char.illness.splice(i, 1); // safe: we're going backwards
	    					msg += ` ${char.name} recovered from the ${ill.name} illness!`;
	    					updateActionPrompt(translateSanity(msg));
	    					eventLog.insertAdjacentHTML('afterbegin', `${msg}<br>`);
	    				} else {
	    					ill.severity = Math.max(0, ill.severity - 1);
	    					msg += ` ${char.name}'s ${ill.name} illness is improving.`;
	    					updateActionPrompt(translateSanity(msg));
	    					eventLog.insertAdjacentHTML('afterbegin', `${msg}<br>`);
	    				}
	    			}
	    		}
	    	}
	    	if (char.health < 100) char.health = Math.min(100, char.health + (2 * recoveryBonus));
	    });
	    
	    if (hasSkill("Animal Handling")) {
	    	this.oxenHealth = Math.min(100, this.oxenHealth + 5)
	    	updateActionPrompt(translateSanity("Your skill with animals helped the oxen recover their strength."));
	    	eventLog.insertAdjacentHTML('afterbegin', `Your skill with animals helped the oxen recover their strength.<br>`);
	    } else {
	    	this.oxenHealth = Math.min(100, this.oxenHealth + 2)
	    }
	    
	    // The dog rests too — same recovery amounts as the oxen
	    if (this.flags && this.flags.has_dog) {
	    	this.dogHealth = Math.min(100, this.dogHealth + (hasSkill("Animal Handling") ? 5 : 2));
	    }
        
        if (wagon.flags.has_dog && Math.random() < 0.3) {
            const dogLines = [
                `${wagon.flags.dog_name} wagged his tail while you rested. You feel a little better.`,
	    		`${wagon.flags.dog_name} tilts their head and looks at you with the cutest expression`,
	    		`${wagon.flags.dog_name} is chasing the oxen around and playing.`,
	    		`${wagon.flags.dog_name} brought you a small present of a squirrel they caught.`,
	    		`${wagon.flags.dog_name} has the Zoomies and is running around the camp.`,
            ];
            followUp = dogLines[Math.floor(Math.random() * dogLines.length)];
	    	updateActionPrompt(translateSanity(`${followUp}`));
	    	eventLog.insertAdjacentHTML('afterbegin', `${followUp}<br>`);
            wagon.sanity = Math.min(100, wagon.sanity + 1);
	    	AudioManager.playSound('woof');
        }
	    
        if (this.flags.has_dusty && Math.random() < 0.25) {
            const dustyLines = [
                "Dusty rustles quietly in the corner. You think he just said 'Roll for initiative.'",
                "Dusty is staring at the fire. He seems to be judging your choice of fuel.",
                "You find Dusty sitting in the driver's seat. He's a very still co-pilot.",
	    		"Dusty seems to be giving you the silent treatment this evening.",
	    		"Dusty seems very happy to see you and saved you a spot next to him.",
            ];
            followUp = dustyLines[Math.floor(Math.random() * dustyLines.length)];
	    	updateActionPrompt(translateSanity(`${followUp}`));
	    	eventLog.insertAdjacentHTML('afterbegin', `${followUp}<br>`);
        }
	    
        if (this.flags.bunny && Math.random() < 0.25) {
	    	updateActionPrompt(translateSanity(`A wild coyote eats your pet bunny in the night. You shed a tear for Reader Rabbit.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `A wild coyote eats your pet bunny in the night. You shed a tear for Reader Rabbit.<br>`);
	    	AudioManager.playSound('yummy');
	    	wagon.flags.bunny = false;
            AchievementManager.data.stats.bunnyDeaths++;
            if (AchievementManager.data.stats.bunnyDeaths >= 3) {
                AchievementManager.unlock('emotional_damage', 'Emotional Damage');
            }
            AchievementManager.save();
        }
	    
        if (this.flags.traveler_thankful && Math.random() < 0.15) {
            this.money += 5;
	    	updateActionPrompt(translateSanity(`You find a small pouch of coins left on your wagon. That traveler you helped must have caught up! (+$5)`));
	    	eventLog.insertAdjacentHTML('afterbegin', `You find a small pouch of coins left on your wagon. That traveler you helped must have caught up! (+$5)<br>`);
            this.flags.traveler_thankful = false; 
        }
	    
        if (this.totalDistance > 500 && Math.random() < 0.1) {
            this.money += 5;
	    	updateActionPrompt(translateSanity(`You look back at the mountains. You still can't believe that 'Sequence Break' worked. You feel like a legend.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `You look back at the mountains. You still can't believe that 'Sequence Break' worked. You feel like a legend.<br>`);
        }
	    
        if (this.flags.ghost_protection && Math.random() < 0.25) {
	    	updateActionPrompt(translateSanity(`The campfire flickers blue for a second. The Ghost of '47 is still watching over you.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `The campfire flickers blue for a second. The Ghost of '47 is still watching over you.<br>`);
            if (typeof showGhost === "function") {
                showGhost();
            } else if (wagon && typeof wagon.showGhost === "function") {
                wagon.showGhost(); 
            }
        }
	    
        if (this.flags.robbed_ghost && Math.random() < 0.25) {
	    	updateActionPrompt(translateSanity(`The campfire flickers like hellfire for a second. You feel like that ghost you robbed is someehow watching you and will someday have its revenge.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `The campfire flickers like hellfire for a second. You feel like that ghost you robbed is someehow watching you and will someday have its revenge.<br>`);
            if (typeof showGhost === "function") {
                showGhost();
            } else if (wagon && typeof wagon.showGhost === "function") {
                wagon.showGhost(); 
            }
        }
	    
        if (this.flags.found_diary && Math.random() < 0.15) {
	    	updateActionPrompt(translateSanity(`You fall asleep reading more of the ghost diary. You swear as you fall asleep you feel someone tuck you in with a blanket.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `You fall asleep reading more of the ghost diary. You swear as you fall asleep you feel someone tuck you in with a blanket.<br>`);
            if (typeof showGhost === "function") {
                showGhost();
            } else if (wagon && typeof wagon.showGhost === "function") {
                wagon.showGhost(); 
            }
        }
	    
        if (this.flags.glitch && Math.random() < 0.1) {
	    	updateActionPrompt(translateSanity(`The campfire is glitching around to different locations and somehow t-posing. What did you introduce into your run?`));
	    	eventLog.insertAdjacentHTML('afterbegin', `The campfire is glitching around to different locations and somehow t-posing. What did you introduce into your run?<br>`);
        }
	    
        if (this.flags.monolith && Math.random() < 0.15) {
	    	updateActionPrompt(translateSanity(`You feel your teeth vibrate and you dream of a weird giant Space Baby.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `You feel your teeth vibrate and you dream of a weird giant Space Baby.<br>`);
	    	AudioManager.playSound('2001');
        }
	    
        if (this.flags.jesus_took_wheel && Math.random() < 0.20) {
            if (jesusImg) jesusImg.style.display = "block";
            if (starImg) starImg.style.display = "block";
            setTimeout(() => {
                if (jesusImg) jesusImg.style.display = "none";
                if (starImg) starImg.style.display = "none";
            }, 3000);
	    	updateActionPrompt(translateSanity(`You see Jesus flying through the sky with a wheel from someone's wagon.`));
	    	eventLog.insertAdjacentHTML('afterbegin', `You see Jesus flying through the sky with a wheel from someone's wagon.<br>`);
	    	AudioManager.playSound('jesusWheel');
        }
	    
        const deadPartyMembers = this.characters.filter(char => char.status === "Dead");
        
        if (deadPartyMembers.length > 0 && Math.random() < 0.15) {
            const ghostlySpokesperson = deadPartyMembers[Math.floor(Math.random() * deadPartyMembers.length)];
            if (typeof wagon.showGhost === "function") {
                wagon.showGhost(); 
            }
            AudioManager.playSound('spooky');
            const ghost = document.getElementById('ghost-sprite');
            if (ghost) {
                setTimeout(() => {
                    speakHint(`Dying is still better than living in Missouri`);
                }, 1500);
                ghost.style.display = 'block';
                setTimeout(() => { ghost.style.opacity = '0.6'; }, 100);
                setTimeout(() => {
                    ghost.style.opacity = '0';
                    setTimeout(() => { ghost.style.display = 'none'; }, 2000);
                }, 10000);
            }
            const ghostLine = `${ghostlySpokesperson.name} appears in the campfire smoke and whispers: "Dying is still better than living in Missouri."`;        
            updateActionPrompt(translateSanity(ghostLine));
            eventLog.insertAdjacentHTML('afterbegin', 
                `<span style="color: #66cccc;">${ghostLine}</span><br>`
            );
            this.sanity = Math.max(0, this.sanity - 2);
        }
	    
        this.statusAdjuster();
	    this.food = Math.max(0, this.food - (this.characters.length * 5));
        this.advanceDay(); 
        this.resourceChecker();
        textUpdateUI(); 
    }

    eventGrabber() {
        const num = Math.floor(Math.random() * 100);
        // Note: this.distance might be a float, Math.floor it for the check
        if ([100, 200, 300, 400, 500].includes(Math.floor(this.distance))) return;

        let negativeThreshold = 30;
        if (this.flags && this.flags.forewarnedUntilDay && this.days <= this.flags.forewarnedUntilDay) {
            negativeThreshold = Math.round(30 * (1 - (this.flags.forewarnedStrength || 0)));
        }

        if (num >= 70) positiveEvent();
        else if (num > negativeThreshold) neutralEvent();
        else negativeEvent();
    }

    profession(name) {
    const occupations = {
        "Banker":     { cash: 1600, bonus: 1.0 },
        "Doctor":     { cash: 1200, bonus: 1.0 },
        "Merchant":   { cash: 1200, bonus: 1.5 },
        "Gunsmith":   { cash: 800,  bonus: 1.0 },
        "Carpenter":  { cash: 800,  bonus: 2.0 },
        "Fisherman":  { cash: 800,  bonus: 2.5 },
        "Hunter":     { cash: 600,  bonus: 2.5 },
		"Guide":      { cash: 500,  bonus: 2.5 },
		"Gamer":      { cash: 500,  bonus: 2.5 },
        "Farmer":     { cash: 400,  bonus: 3.0 },
        "Prospector": { cash: 400,  bonus: 3.0 },
        "Tailor":     { cash: 400,  bonus: 3.5 },
        "Teacher":    { cash: 400,  bonus: 5.0 }
    };

    const choice = occupations[name] || occupations["Teacher"];

    this.money += choice.cash;
    if (this.challengeMode === 'ramsey') {
        this.money = Math.ceil(this.money / 2);
    }
    this.professionName = name;
    this.scoreBonus = choice.bonus;

    if (name === "Gamer") {
        this.skill = []; // Expecting an array of 2
        this.isGamer = true; // Flag for 4th-wall break messages
    } else {
        this.skill = ProfessionSkills[name] || "None";
    }
	if (DEBUG) console.log(`Profession: ${wagon.professionName}, Skill Assigned: ${wagon.skill}`);
    }

    getAvailableAnimals() {
    const zoneKey = `zone${this.currentZone}`;
    return ANIMALS.filter(a => a[zoneKey] === true);
    }

    huntingTime() {
    if (this.challengeMode === 'vegetarian') {
        updateActionPrompt("Vegetarian Run: you leave the rifle in the wagon. Not today, not ever, not for this run.");
        return;
    }
    this.huntDaylight = 100; 
    this.huntState = null; 
    renderHuntDashboard(generateHuntOptions());
    }

    buildScore() {
	if (this.flags && this.flags.cheated) {
        return 0;
    }
    let s = 0;
    
    // Survivors: Weighted by health status
    this.characters.forEach(char => {
        if (char.status === "Good") s += 500;
        else if (char.status === "Fair") s += 400;
        else if (char.status === "Poor" || char.status === "Mostly Dead") s += 300;
    });

    // Equipment & Animals
    s += (this.oxen * 50);
    s += (this.wheels + this.axles + this.tongues) * 50;

    // Basic Supplies
    s += Math.floor(this.food / 25);
    s += Math.floor(this.bullets / 50);
    s += (this.clothing * 2);

    // THE TYCOON BONUS: Books and high-value Junk
    s += (this.books * 10);
    s += (this.junk * 150); 
    if (this.flags.has_epic_fish) s += 250;
	if (this.flags.bigfoot_talisman) {
		s += 500;
		updateActionPrompt(translateSanity("Bigfoot promised his talisman was not a mushroom. It is a Nonfungible Token worth 500 points!"));
		eventLog.insertAdjacentHTML('afterbegin', `Bigfoot promised his talisman was not a mushroom. It is a Nonfungible Token worth 500 points!<br>`);
	}

    // Trail Length Modifier
    // Baseline is Oregon (2170 miles). Multiplier = (Route Length / 2170)
    const baseDistance = 2170;
    let currentRouteLength = RouteDistances[this.route] || baseDistance;
    
    // Ironman score multiplier scales dynamically out to infinity with your actual mileage!
    if (this.route === "Ironman") {
        currentRouteLength = Math.max(baseDistance, this.totalDistance);
    }
    
    const lengthMultiplier = currentRouteLength / baseDistance;

    // Final Calculation
    // Apply length modifier first, then the profession bonus
    const baseTotal = s * lengthMultiplier;
    const professionTotal = Math.floor(baseTotal * (this.scoreBonus || 1.0));
    // Final Difficulty Adjustment
    // Easy (1.1) yields a 0.9 penalty; Hard (0.9) yields a 1.1 bonus
    const diffBonus = this.difficulty === "Easy" ? 0.9 : (this.difficulty === "Hard" ? 1.1 : 1.0);
    
    return Math.floor(professionTotal * diffBonus);
    }

    advanceDay() {
    this.day++;
    const daysInCurrentMonth = MonthDays[this.month];
    
    if (this.day > daysInCurrentMonth) {
        this.day = 1;
        const months = Object.keys(MonthDays);
        let nextMonthIndex = months.indexOf(this.month) + 1;
        if (nextMonthIndex >= months.length) {
            nextMonthIndex = 0;
            this.year++;
        }
        this.month = months[nextMonthIndex];
    }
    
    // Update the UI
    document.querySelector('.current-date').textContent = `${this.month} ${this.day}, ${this.year}`;
    }

    triggerWeather(type) {
    const log = eventLog;
    const overlay = document.getElementById("weather-overlay");
    
	let path = `./img/weather/${type}.png`;
	let weatherImg = getImagePath(path);
    if (overlay) {
        overlay.style.backgroundImage = `url(${weatherImg})`;
        overlay.style.display = "block";
        // Hide it after a short delay
        setTimeout(() => overlay.style.display = "none", 2000);
    }
	
	if (type == "thunderstorm") AudioManager.playSound('thunder');

    const aliveCount = this.characters.length;
    const clothingPerMember = this.clothing / aliveCount;
    const isColdWeather = (type === "snow" || type === "thunderstorm");
    const isHarshWeather = (type === "rain" || type === "heat");

    let healthPenalty = 0;
    if (!this.flags.bigfoot_blanket) {  // Bigfoot blanket provides warmth
	    if (clothingPerMember < 2) {
            if (isColdWeather) healthPenalty = 3;
            if (isHarshWeather) healthPenalty = 2;
        } else if (clothingPerMember < 1) {
            if (isColdWeather) healthPenalty = 1.5;
            if (isHarshWeather) healthPenalty = 1;
        }
	}

    if (healthPenalty > 0) {
        for (let i = 0; i < this.characters.length; i++) {
            let char = this.characters[i];
            if (char.status === "Dead") continue;
            char.health -= healthPenalty;
            if (char.health <= 0) {
                this.killCharacter(i, "Weather Exposure");
            }
        }
	    
        const exposureMsg = (this.challengeMode === 'nudist')
            ? `The weather is severe and you are, as planned, wearing nothing. Commitment has a cost.`
            : `The weather is severe and your clothing is inadequate! You have been voted off Project Runway.`;
        log.insertAdjacentHTML('afterbegin', `<span style="color:red;">${exposureMsg} -${healthPenalty} Health.</span><br>`);
        updateActionPrompt(translateSanity(exposureMsg));
        textUpdateUI();
    }

    if (type === "rain") this.weatherMultiplier = 0.9;
    else if (type === "snow" || type === "heat" || type === "thunderstorm") this.weatherMultiplier = 0.8;
    else this.weatherMultiplier = 1.0;
    }

    calculateEnvironment() {
    const zone = Zones[this.currentZone];
    
    // Calculate Seasonal Modifiers
    const tempMod = MonthTempModifiers[this.month] || 0;
    const precipMod = MonthPrecipModifiers[this.month] || 0;
    
    // Adjust Values (with random fluctuation)
    this.currentTemp = zone.baseTemp + tempMod + (Math.random() * 10 - 5);
    this.grassChance = Math.max(0, Math.min(1, zone.grassChance + precipMod));
    this.precipProb = Math.max(0, Math.min(1, zone.precipProb + precipMod));
    
    // Determine Environmental State
    this.hasWater = Math.random() < this.precipProb;
    this.hasGrass = Math.random() < this.grassChance;
    this.isSnowing = (this.currentTemp <= 32);

    // Oxen Health logic
    let healthPenalty = 0;
    if (!this.hasGrass) healthPenalty += 2;
    if (!this.hasWater) healthPenalty += 2;
	if (hasSkill("Animal Handling")) healthPenalty *= 0.5;
	let paceMod = (this.pace === "Grueling") ? 2 : 1; 
	if (hasSkill("Animal Handling")) paceMod = 1;
	this.oxenHealth -= (healthPenalty * paceMod);
    
    // Clamp and check for death
    this.oxenHealth = Math.max(0, Math.min(100, this.oxenHealth));
    if (this.oxenHealth <= 0) {
        this.oxen -= 1;
        this.oxenHealth = 100;
        eventLog.insertAdjacentHTML('afterbegin', 
            `<span style="color:red;">An ox has died!  It is clearly not the Year of the Ox in the Chinese Zodiac.</span><br>`);
		updateActionPrompt(translateSanity(`An ox has died! It is clearly not the Year of the Ox in the Chinese Zodiac.`));
    }

    if (this.flags && this.flags.has_dog) {
        let dogPenalty = 0;
        if (this.food <= 0) dogPenalty += 2;     // hungry dog (grass-equivalent)
        if (!this.hasWater) dogPenalty += 2;     // same water penalty as oxen
        if (hasSkill("Animal Handling")) dogPenalty *= 0.5;
        let dogPaceMod = (this.pace === "Grueling") ? 2 : 1;
        if (hasSkill("Animal Handling")) dogPaceMod = 1;
        this.dogHealth -= (dogPenalty * dogPaceMod);
        this.dogHealth = Math.max(0, Math.min(100, this.dogHealth));

        const dName = this.flags.dog_name || "Buster";

        // Tiered warnings: fire once when crossing each threshold, re-arm on recovery. The UI never shows dog health, so these messages are the player's only signal.
        if (this.dogHealth > 0 && this.dogHealth < 20 && !this.flags.dogWarned20) {
            this.flags.dogWarned20 = true;
            const warnMsg = `${dName} can barely lift their head. Their tail hasn't wagged in days. Without rest or care soon, you're going to lose them.`;
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:red;">${warnMsg}</span><br>`);
            updateActionPrompt(translateSanity(warnMsg));
            AudioManager.playSound('whimper');
        } else if (this.dogHealth < 50 && !this.flags.dogWarned50) {
            this.flags.dogWarned50 = true;
            const warnMsg = `${dName} is limping along behind the wagon and skipping meals. The trail is wearing your good ${this.dogHealth < 35 ? 'very tired' : ''} dog down.`;
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#f0ad4e;">${warnMsg}</span><br>`);
            updateActionPrompt(translateSanity(warnMsg));
        }
        if (this.dogHealth >= 50) this.flags.dogWarned50 = false;
        if (this.dogHealth >= 20) this.flags.dogWarned20 = false;

        if (this.dogHealth <= 0) {
            this.flags.has_dog = false;
            this.flags.departed_dog_name = dName; // remembered for any future memorials
            this.sanity = Math.max(0, this.sanity - 15);
            const deathMsg = `${dName} lay down beside the trail this morning and didn't get up. The best boy is gone. The whole party walks in silence. (-15 Sanity)`;
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:red;">${deathMsg}</span><br>`);
            updateActionPrompt(translateSanity(deathMsg));
            AudioManager.playSound('whimper');
        }
    }
    }

    updateGroundVisuals() {
    const ground = document.getElementById('layer-ground');
    if (!ground) return;

    if (this.isSnowing) {
        ground.style.backgroundColor = "#FFFFFF"; // Snow
    } else if (this.grassChance < 0.3) {
        ground.style.backgroundColor = "#8B4513"; // Brown (Drought/Desert)
    } else {
        ground.style.backgroundColor = "#228B22"; // Green (Healthy)
    }
    }

    triggerGlitchInTheWoods() {
    this.flags.glitch = true;
    const gameScreen = document.getElementById('gameMainScreen');
    
    // Visual 'Break'
    gameScreen.style.filter = "invert(1) hue-rotate(180deg) blur(2px)";
    AudioManager.playSound('static');

    triggerChoiceEvent({
        title: "E R R O R : The Null Woods",
        message: "The trees around the trail begin to vibrate and lose their color. A giant floating 'MISSING_TEXTURE.PNG' block stands in your path. Do you enter the unrendered zone?",
        choices: [
            { text: "Enter the Null Zone", action: () => {
                if (Math.random() < 0.4) {
                    const skip = 100;
                    wagon.totalDistance += skip;
                    // Move them significantly forward in the current leg
                    wagon.milesToNextLandmark = Math.max(10, this.milesToNextLandmark - skip);
                    updateActionPrompt("SUCCESS: You traveled through the backrooms of the trail. You skipped 100 miles.");
                    gameScreen.style.filter = "none";
                } else {
                    wagon.totalDistance -= 50; // Teleport back
                    updateActionPrompt("CRITICAL ERROR: The zone rejected your collision box. You were teleported 50 miles backward.");
                    gameScreen.style.filter = "none";
                    wagon.sanity = Math.max(0,   wagon.sanity - 20);
                }
            }},
            { text: "Stay in the Skybox", action: () => {
                updateActionPrompt("You closed your eyes until the textures reloaded. Safety first.");
                gameScreen.style.filter = "none";
            }}
        ]
    });
    }

    showGhost() {
    const ghost = document.getElementById('ghost-sprite');
    if (ghost) {
        setTimeout(() => {
            speakHint(`On this episode of Ghost Hunters`);
        }, 1500);
		AudioManager.playSound('spooky');
        ghost.style.display = 'block';
        setTimeout(() => { ghost.style.opacity = '0.6'; }, 100);
        setTimeout(() => {
            ghost.style.opacity = '0';
            setTimeout(() => { ghost.style.display = 'none'; }, 2000);
        }, 10000);
    }
    }
}

function triggerLandmarkUI(landmarkKey) {
    const safeKey = landmarkKey.replace(/'/g, "\\'");
	showSplashScreen(safeKey);
}

// Shared by updateZoneBackground() and TrailCanvasRenderer, so the "which
// background image is showing right now" rule only exists in one place.
function zoneBackgroundPath(zone) {
    let path = `./img/background-${zone}.png`;
    if (wagon.sanity < 20) {
        path = `./img/background-${zone}-insane.png`;
    }
    return path;
}

function updateZoneBackground(zone) {
    const bgLayer = document.getElementById('layer-background');
    if (bgLayer) {
        bgLayer.style.backgroundImage = `url('${getImagePath(zoneBackgroundPath(zone))}')`;
    }
}

const TrailCanvasRenderer = {
    canvas: null,
    ctx: null,
    dpr: 1,
    lastCssWidth: 0,
    lastCssHeight: 0,
    imageCache: new Map(),
    scrollX: 0,          // current, smoothly-animated background scroll position
    running: false,
    rafId: null,

    init() {
        this.canvas = document.getElementById('trail-canvas');
        if (!this.canvas) return; // page doesn't have the canvas (shouldn't happen, but don't crash)
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => this.resize());

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stop();
            } else {
                this.start();
            }
        });

        this.start();
    },

    start() {
        if (this.running) return;
        this.running = true;
        const loop = (t) => {
            if (!this.running) return;
            this.render(t);
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    },

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    },

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return; // hidden right now (e.g. still on the setup screen)
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(rect.width * this.dpr);
        this.canvas.height = Math.round(rect.height * this.dpr);
        this.lastCssWidth = rect.width;
        this.lastCssHeight = rect.height;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    getImage(path) {
        let img = this.imageCache.get(path);
        if (!img) {
            img = new Image();
            img.src = path;
            this.imageCache.set(path, img);
        }
        return img;
    },

    render() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            (Math.round(rect.width) !== Math.round(this.lastCssWidth) || Math.round(rect.height) !== Math.round(this.lastCssHeight))) {
            this.resize();
        }
        if (!wagon || this.lastCssWidth <= 0 || this.lastCssHeight <= 0) return; // nothing to draw yet

        const w = this.lastCssWidth;
        const h = this.lastCssHeight;
        this.ctx.clearRect(0, 0, w, h);

        this.renderBackground(w, h);
        this.renderLandmark(w, h);
    },

    renderBackground(w, h) {
        const path = getImagePath(zoneBackgroundPath(wagon.currentZone));
        const img = this.getImage(path);
        if (!img.complete || !img.naturalWidth) return;

        const target = (wagon.totalDistance * 5) % 2048;
        let delta = target - this.scrollX;
        delta = ((delta % 2048) + 2048 * 1.5) % 2048 - 2048 * 0.5;
        this.scrollX = (this.scrollX + delta * 0.08 + 2048) % 2048;

        const drawH = h;
        const drawW = img.naturalWidth * (drawH / img.naturalHeight);
        if (drawW <= 0) return;

        let startX = (this.scrollX % drawW) - drawW;
        for (let x = startX; x < w; x += drawW) {
            this.ctx.drawImage(img, x, 0, drawW, drawH);
        }
    },

    renderLandmark(w, h) {
        const layerEl = document.getElementById('layer-landmark');
        const imgEl = document.getElementById('landmark-graphic');
        if (!layerEl || !imgEl) return;

        const layerStyle = getComputedStyle(layerEl);
        if (layerStyle.display === 'none' || imgEl.style.display === 'none' || !imgEl.src) return;

        const img = this.getImage(imgEl.src);
        if (!img.complete || !img.naturalWidth) return;

        const centerX = parseFloat(layerStyle.left) || 0;

        const drawH = h * 0.47; // matches the old max-height:47%
        const drawW = img.naturalWidth * (drawH / img.naturalHeight);
        const drawX = centerX - drawW / 2;
        const drawY = h - drawH; // bottom-aligned to the horizon (canvas bottom = top of the ground strip)

        this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TrailCanvasRenderer.init();
});

function refreshLandmarkGraphic() {
    const landmarkImg = document.getElementById('landmark-graphic');
    const currentLoc = Landmarks[wagon.currentLandmark];
    
    if (landmarkImg && currentLoc) {
        const newPath = getImagePath(`./img/landmarks/${currentLoc.num}.png`);
        landmarkImg.src = ''; // Clear to force trigger
        landmarkImg.src = newPath; 
    }
}

function proceedFromLandmark(landmarkKey) {
    const safeKey = landmarkKey.replace(/'/g, "\\'");
	const loc = Landmarks[landmarkKey];
    const icon = document.getElementById('layer-landmark');
	if (DEBUG) console.log("loc: ", loc);
	if (DEBUG) console.log("Landmark Key: ", landmarkKey);

	if (wagon.nextPlannedStop) {
        wagon.currentLandmark = wagon.nextPlannedStop;
        wagon.nextPlannedStop = null; // Flush cache safely
        toggleModal("#myModal"); // Close splash and resume gameplay tracking tracking
        return;
    }

    if (icon && wagon.totalDistance > 0) {
        icon.style.transition = 'none';
        icon.style.display = 'none';
        icon.style.left = '-20%'; 

        // Use the timeout to ensure the "hidden" state is rendered by the browser
        setTimeout(() => {
            icon.style.display = 'flex';
            setTimeout(() => {
                icon.style.transition = 'left 0.5s linear';
            }, 20);
        }, 0);
    }

    if (safeKey === "Donner Pass" && wagon.route !== "Random" && wagon.route !== "Ironman") {
        startCaliforniaFinale();
		return;
	}
    else if (safeKey === "Salt Lake Valley" && wagon.route !== "Random" && wagon.route !== "Ironman") {
        startMormonFinale();
		return;
    }
    else if (safeKey === "Santa Fe" && wagon.route !== "Random" && wagon.route !== "Ironman") {
        startSantaFeFinale();
		return;
	}
    else if (safeKey === "Virginia City" && wagon.route !== "Random" && wagon.route !== "Ironman") {
        startBozemanFinale();
		return;
	}
    else if (safeKey === "Independence" && wagon.route === "UNO Reverse" && wagon.route !== "Random" && wagon.route !== "Ironman") {
        startRiverRafting()
		return;
	}
	else if (wagon.route === "Random" && wagon.pathHistory.length >= 25) {
        toggleModal("#myModal"); // Close splash
        
        // Pick a random finale game index wrapper sequence from your 5 existing profiles
        const finales = ["California", "Mormon", "Santa Fe", "Bozeman", "Raft"];
        const chosenFinale = finales[Math.floor(Math.random() * finales.length)];
        
        updateActionPrompt(`CRITICAL ERROR: The reality fabric collapsed! Launching ${chosenFinale} Finale logic...`);
        eventLog.insertAdjacentHTML('afterbegin', `The random space-time loop breaks! Loading final challenge...<br>`);

        // Route directly into your existing game modules dynamically
        if (chosenFinale === "California") startCaliforniaFinale();
        else if (chosenFinale === "Mormon") startMormonFinale();
        else if (chosenFinale === "Santa Fe") startSantaFeFinale();
        else if (chosenFinale === "Bozeman") startBozemanFinale();
        else if (chosenFinale === "Raft") startRiverRafting();
        return;
    }
	else if (safeKey === "The Dalles") {
		if (wagon.route === "UNO Reverse" || wagon.route === "Random" || wagon.route === "Ironman") {
			updateActionPrompt("You pass through The Dalles safely on your return trip.");
			proceedFromLandmark("Blue Mountains"); // Auto-continue to the next node
			return;
		}
        const content = modalChild;
        content.innerHTML = `
            <h3>THE FINAL CHOICE</h3>
            <p>You've reached The Dalles. Willamette Valley is within reach, but the path is blocked.</p>
            <div class="buttons">
                <button ${actionAttrs('takeTollRoad')} class="btn btn-warning">Barlow Toll Road ($50.00)</button>
                <button ${actionAttrs('startRiverRafting')} class="btn btn-primary">Navigate the Rapids (FREE/DEADLY)</button>
            </div>
        `;
        return;
    } else {
		if (loc.type === "fort") {
			buildFortModal(loc);
		} else if (loc.type === "river") {
			// Free refill: you're standing next to several million gallons of the stuff
			if (wagon.waterBarrels > 0 && wagon.water < wagon.waterBarrels * WATER_PER_BARREL) {
				wagon.water = wagon.waterBarrels * WATER_PER_BARREL;
				eventLog.insertAdjacentHTML('afterbegin', `You topped off every water barrel from the river. Hydration: achieved.<br>`);
			}
			buildRiverModal(loc);
		} else if ((loc.type === "end") && (wagon.route !== "UNO Reverse") && (wagon.route !== "Random")) {
			finalizeJourney(true);
		} else {
			// If a branching hub (like South Pass) is closed, pull up the branch buttons explicitly
			let nextOptions = (typeof loc.getNext === 'function') ? [loc.getNext(wagon.route)] : loc.next;
			if (nextOptions.length > 1) {
				buildBranchingModal(safeKey, nextOptions);
			} else {
				toggleModal("#myModal");
			}
		}
	}
}

function buildStandardModal(loc) {
    const content = modalChild;
    content.innerHTML = `
        <h3>${loc.name}</h3>
        <p>${loc.description || "You have reached a landmark on the trail."}</p>
        <div class="buttons">
            <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-success">Continue Journey</button>
        </div>
    `;
}

function buildFortModal(loc) {
    const content = modalChild;
    const weightWarning = wagon.weightWarningText();
    const saloonBanned = wagon.flags && wagon.flags[`saloonBanned_${wagon.currentLandmark}`];
    const storeBanned = isStoreBanned();
    const ludditeLocked = wagon.challengeMode === 'luddite' && wagon.totalDistance > 0;
    content.innerHTML = `
        <h3>${loc.name}</h3>
        <p>A safe haven in the wilderness. What would you like to do?</p>
        ${weightWarning ? `<p style="color:#b8860b; border:1px dashed #b8860b; padding:6px; font-size:0.9em;">⚖️ ${weightWarning}</p>` : ''}
        ${ludditeLocked ? `<p style="color:#a0785a; border:1px dashed #a0785a; padding:6px; font-size:0.9em;">🪓 Luddite Run: you won't buy manufactured goods here. Whatever you need, you make with your own two hands.</p>` : ''}
        <div class="buttons">
            <button ${actionAttrs('openFortStore', [], { noTitle: true })} class="btn btn-info" ${ludditeLocked ? 'disabled title="Luddite Run: no store purchases after Independence."' : (storeBanned ? 'disabled title="You got caught. This shopkeeper never wants to see you again."' : 'title="Everything\'s overpriced this far from civilization."')}>Buy Supplies</button>
            <button ${actionAttrs('openStealMenu', [], { noTitle: true })} class="btn btn-danger" ${storeBanned ? 'disabled title="You are not welcome back in that store."' : 'title="Five-finger discount, on the house (literally)."'}>🖐️ Pilfer the Store</button>
            <button ${actionAttrs('openBuybackMenu')} class="btn btn-warning">Sell Junk ($)</button>
            <button ${actionAttrs('fortTalk')} class="btn btn-info">Talk to People</button>
            <button ${actionAttrs('openSaloon', [], { noTitle: true })} class="btn btn-warning" ${saloonBanned ? 'disabled title="You are not welcome back here."' : (gamblingBlocked() ? 'disabled title="Dave Ramsey Mode: gambling is not in the budget."' : 'title="Whiskey, cards, and questionable decisions await."')}>🥃 Visit the Saloon</button>
            <button ${actionAttrs('visitBrothel')} class="btn btn-warning">💋 Visit the Brothel</button>
            <button ${actionAttrs('openTelegraphOffice', [], { noTitle: true })} class="btn btn-info" ${isTelegraphSent() ? 'disabled title="Already sent from this fort."' : 'title="Reach out and touch someone. By Morse code. Slowly."'}>📨 Telegraph Home for Money</button>
            <button ${actionAttrs('leaveFortPrompt')} class="btn btn-success">Leave Fort</button>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function openBuybackMenu() {
    const content = modalChild;
    // Scale the buyback value as well—Matt pays more for rare items out west!
    const multiplier = FortMultipliers[wagon.currentLandmark] || 1.0;
    const junkValue = (2.50 * multiplier).toFixed(2);
    const totalReturn = (wagon.junk * junkValue).toFixed(2);

    speakHint(`Well now, traveler. I reckon I could take that junk off your hands for about ${junkValue} dollars apiece.`);

    content.innerHTML = `
        <h3>Matt's Recycling Bin</h3>
        <p>Matt's looking for "reclaimed artifacts."</p>
        <p>Current Offer: <strong>$${junkValue}</strong> per item.</p>
        <div class="buttons">
            ${wagon.junk > 0 ? `<button ${actionAttrs('confirmBuyback', [totalReturn])} class="btn btn-success">Sell All for $${totalReturn}</button>` : "<p>You have no junk to trade.</p>"}
            <button ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])} class="btn btn-danger">Back</button>
        </div>
    `;
}

function confirmBuyback(amount) {
    wagon.money += Number(amount) || 0;
    wagon.junk = 0;
    updateActionPrompt(translateSanity(`You sold your junk for $${amount}. Matt looks at your 'World's Okayest Pioneer' mug and sighs.`));
	eventLog.insertAdjacentHTML('afterbegin', `You sold your junk for $${amount}. Matt looks at your 'World's Okayest Pioneer' mug and sighs.<br>`);
    textUpdateUI();
    buildFortModal(Landmarks[wagon.currentLandmark]);
}

function openFortStore() {
    if (isStoreBanned()) {
        updateActionPrompt("The shopkeeper still remembers what you tried to walk out with. You're not welcome in there.");
        return;
    }
    if (wagon.challengeMode === 'luddite' && wagon.totalDistance > 0) {
        updateActionPrompt("Luddite Run: you refuse to buy manufactured goods out here. Independence was the only store you get.");
        return;
    }
    updateStoreUnitPrices();
    resetStoreInputs();
    toggleModal('#myModal');
    
    const storeEl = document.getElementById('store');
    const backBtn = document.getElementById("back-button");
    const leaveBtn = document.getElementById("leave-store-btn");
    
    storeEl.style.display = 'block';

    if (backBtn) backBtn.style.display = 'none';
    if (leaveBtn) {
        leaveBtn.style.display = 'inline-block';
        leaveBtn.onclick = (e) => {
            e.preventDefault();
            storeEl.style.display = 'none';
            buildFortModal(Landmarks[wagon.currentLandmark]);
        };
    }

    textUpdateUI();
}

function isStoreBanned() {
    return !!(wagon.flags && wagon.flags[`storeBanned_${wagon.currentLandmark}`]);
}

function banFromStore() {
    if (!wagon.flags) wagon.flags = {};
    wagon.flags[`storeBanned_${wagon.currentLandmark}`] = true;
}

function stealCatchChance(item) {
    const fortMult = FortMultipliers[wagon.currentLandmark] || 1.0;
    const diffRisk = { "Easy": 0.8, "Normal": 1.0, "Hard": 1.25, "New Game+": 1.5 }[wagon.difficulty] || 1.0;
    const priorAttempts = (wagon.flags && wagon.flags[`storeSuspicion_${wagon.currentLandmark}`]) || 0;

    const weightRisk = Math.min(0.50, item.weight / 45);
    const fortRisk = Math.min(0.35, (fortMult - 1) * 0.18);
    const suspicionRisk = Math.min(0.25, priorAttempts * 0.05);

    let chance = (0.12 + weightRisk + fortRisk + suspicionRisk) * diffRisk;
    if (hasSkill("Trade")) chance *= 0.7; // a lifetime of haggling teaches you where a shopkeeper's eyes go

    return Math.max(0.05, Math.min(0.92, chance));
}

function stealRiskLabel(weight) {
    if (weight <= 2) return "Low risk — small enough to vanish into a pocket.";
    if (weight <= 6) return "Moderate risk — you'll need both hands free.";
    if (weight <= 16) return "High risk — bulky, and hard to explain if you're stopped.";
    return "Extremely high risk — good luck concealing that.";
}

function openStealMenu() {
    renderStealUI();
}

function renderStealUI(banner = '') {
    const content = modalChild;
    const loc = Landmarks[wagon.currentLandmark];

    if (isStoreBanned()) {
        content.innerHTML = `
            <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
                <h3 style="color:#e0a83c;">🖐️ Five Finger Discount</h3>
                ${banner ? `<p style="color:#ff6666; font-weight:bold;">${translateSanity(banner)}</p>` : ''}
                <p>${translateSanity(`The shopkeeper at ${loc.name} knows your face now. You are not getting back in.`)}</p>
                <div class="buttons"><button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back to Fort</button></div>
            </div>
        `;
        if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
        return;
    }

    // Nudist Run locks clothing ownership to zero for the whole run — don't let stealing be the loophole that undoes that.
    const availableItems = STEALABLE_ITEMS.filter(item =>
        !(item.key === 'clothing' && wagon.challengeMode === 'nudist')
    );

    const itemsHtml = availableItems.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid #8b5a2b; padding:8px 10px; margin-bottom:6px; background:rgba(255,255,255,0.04);">
            <div style="text-align:left;">
                <strong style="color:#ffd700; text-transform:capitalize;">${item.label}</strong><br>
                <span style="color:#aaa; font-size:0.8em;">${item.weight} lbs — ${stealRiskLabel(item.weight)}</span>
            </div>
            <button class="btn btn-danger" ${actionAttrs('attemptSteal', [item.key], { noTitle: true })} title="No going back once your hand's on the shelf.">Swipe It</button>
        </div>
    `).join('');

    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#e0a83c;">🖐️ Five Finger Discount</h3>
            <p>${translateSanity("Matt's turned his back for a second. Long enough, maybe.")}</p>
            ${banner ? `<p style="color:#8fd694; font-weight:bold;">${translateSanity(banner)}</p>` : ''}
            <div style="text-align:left; max-width:440px; margin:0 auto;">${itemsHtml}</div>
            <div class="buttons" style="margin-top:14px;">
                <button class="btn btn-success" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Leave Well Enough Alone</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function attemptSteal(itemKey) {
    if (!wagon || isStoreBanned()) return;
    const item = STEALABLE_ITEMS.find(i => i.key === itemKey);
    if (!item) return;

    if (!wagon.flags) wagon.flags = {};
    const suspicionKey = `storeSuspicion_${wagon.currentLandmark}`;
    wagon.flags[suspicionKey] = (wagon.flags[suspicionKey] || 0) + 1;

    const caught = gamblingRandom() < stealCatchChance(item);
    const locName = Landmarks[wagon.currentLandmark].name;
    let banner;

    if (caught) {
        AudioManager.playSound('alert');
        adjustKarma(-12); // costs more than a clean success — you got caught being a thief
        banFromStore();
        banner = `"HEY! Get your hands off that!" A grip like a bear trap lands on your collar. You're thrown out — and you're not welcome back at ${locName}'s store.`;
        eventLog.insertAdjacentHTML('afterbegin', `Caught stealing ${item.label} at ${locName}. Banned from the store.<br>`);
        AchievementManager.unlock('caught_stealing', 'Not Very Sneaky');
    } else {
        AudioManager.playSound('trade');
        adjustKarma(-4); // getting away with it still costs you something
        wagon[item.field] = (wagon[item.field] || 0) + item.wagonAmount;
        banner = `Smooth as ever — you walk out with ${item.label} and nobody's the wiser. Your conscience notices, even if the shopkeeper didn't.`;
        eventLog.insertAdjacentHTML('afterbegin', `Stole ${item.label} from the store at ${locName}.<br>`);
        AchievementManager.unlock('five_finger_discount', 'Five Finger Discount');
    }

    persistGamblingState();
    textUpdateUI();
    renderStealUI(banner);
}

function buildBranchingModal(currentKey, options) {
    const content = modalChild;
    const loc = Landmarks[currentKey];
    
    let buttonHTML = '';
    options.forEach((optKey, index) => {
        const opt = Landmarks[optKey];
		const escapedName = optKey.replace(/'/g, "\\'");
		buttonHTML += `<button ${actionAttrs('choosePath', [escapedName, loc.distanceToNext[index]])} class="btn btn-info">${opt.name}</button>`;
	});

    content.innerHTML = `
        <h3>${loc.name}</h3>
        <p>The trail splits here. Which way will you go?</p>
        <div class="buttons">${buttonHTML}</div>
    `;
    toggleModal("#myModal");
}

// Logic for choosing a branch
function choosePath(landmarkKey, distance) {
    wagon.nextLandmark = landmarkKey; // Explicitly assign our selected branch target destination
    wagon.milesToNextLandmark = distance;
	const landmarkName = Landmarks[landmarkKey].name;
    toggleModal("#myModal");
    updateActionPrompt(`You chose the path to ${landmarkName}.`);
    eventLog.insertAdjacentHTML('afterbegin', `You chose the path to ${landmarkName}.<br>`);
}

function fortTalk() {
    const randomName = NPC_names[Math.floor(Math.random() * NPC_names.length)];
    let randomHint = hints[Math.floor(Math.random() * hints.length)];
	randomHint = translateSanity(randomHint);
    
    buildTalkModal(randomName, randomHint);
}

function buildTalkModal(name, message) {
    const content = modalChild;
	const safeKey = wagon.currentLandmark.replace(/'/g, "\\'");

    const spokenMessage = translateSanity(message);

    content.innerHTML = `
        <h3>${name} says...</h3>
        <div class="ongoing-events">
            <p>"${spokenMessage}"</p>
        </div>
        <div class="buttons">
            <button ${actionAttrs('returnToFortTalk', [safeKey])} class="btn btn-success">Back to Fort Menu</button>
        </div>
    `;
}

const TRUE_RANDOM = Math.random.bind(Math);
let dailyRngState = null;           // null = normal play, number = daily mode
let pendingDailyChallenge = null;   // set between menu click and wagon creation

function hashDailySeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

function utcTodayString() {
    return new Date().toISOString().slice(0, 10); // e.g. "2026-07-12", same worldwide
}

function seededDailyRandom() {
    dailyRngState = (dailyRngState + 0x6D2B79F5) >>> 0;
    let t = dailyRngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function enableDailyChallengeRNG(seedState) {
    dailyRngState = seedState >>> 0;
    Math.random = seededDailyRandom;
}

function disableDailyChallengeRNG() {
    dailyRngState = null;
    Math.random = TRUE_RANDOM;
}

function difficultyIntensityScale() {
    const scale = { "Easy": 0.9, "Normal": 1.0, "Hard": 1.1, "New Game+": 1.3 };
    return scale[wagon.difficulty] || 1.0;
}

// --- New Game+ --------------------------------------------------------
const NGPLUS_KEY = 'oregon_ngplus_carryover';
const NGPLUS_CARRIED_FLAGS = [
    'bigfoot_blanket', 'masonic_handshake', 'has_dog', 'bigfoot_talisman',
    'traveler_thankful', 'union_leader', 'jesus_took_wheel', 'jesus_wine',
    'shaman', 'selfie', 'found_diary', 'glitch', 'monolith', 'robbed_ghost',
    'ghost_protection', 'has_dusty', 'bigfoot_piss', 'has_epic_fish',
];

function hasBeatenGameOnce() {
    return AchievementManager.data.stats.trailsCompleted.length > 0;
}

function snapshotNewGamePlusCarryover() {
    try {
        const snapshot = {};
        NGPLUS_CARRIED_FLAGS.forEach(key => {
            snapshot[key] = !!(wagon.flags && wagon.flags[key]);
        });
        // dog_name rides alongside has_dog as the one non-boolean exception —
        // "you have a dog" isn't very satisfying if it forgets the dog's name.
        snapshot.dog_name = (wagon.flags && wagon.flags.dog_name) || null;
        localStorage.setItem(NGPLUS_KEY, JSON.stringify(snapshot));
    } catch (e) { if (DEBUG) console.log("NG+ snapshot failed:", e); }
}

function applyNewGamePlusCarryover() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(NGPLUS_KEY)); } catch (e) { /* nothing to carry */ }
    if (!saved) return;
    if (!wagon.flags) wagon.flags = {};
    NGPLUS_CARRIED_FLAGS.forEach(key => {
        if (saved[key]) wagon.flags[key] = true;
    });
    if (saved.has_dog) {
        wagon.flags.dog_name = saved.dog_name || "Buster";
        wagon.dogHealth = 100; // a fresh trail deserves a fresh, well-rested dog
    }
}

function applyNewGamePlusUnlock() {
    const opt = document.querySelector("#difficulty option[value='New Game+']");
    if (!opt) return;
    const unlocked = hasBeatenGameOnce();
    opt.disabled = !unlocked;
    opt.title = unlocked ? '' : "Beat the game once to unlock New Game+.";
}

function clothingUnitPrice() {
    return (wagon && wagon.challengeMode === 'winter') ? 20 : 10;
}
function firewoodUnitPrice() {
    return (wagon && wagon.challengeMode === 'winter') ? 2 : 1;
}

function draftAnimalUnitPrice() {
    return getDraftAnimalConfig(wagon && wagon.draftAnimal).unitCost;
}

function applyVegetarianButtonLock() {
    const isVeg = wagon && wagon.challengeMode === 'vegetarian';
    const defaultTooltips = {
        'hunt-button': "Shoot 2000 pounds of meat, carry back 100. Classic.",
        'fish-button': "Teach a family to fish, and they'll complain about it for weeks."
    };
    ['hunt-button', 'fish-button'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const tooltipSpan = btn.querySelector('.tooltiptext');
        btn.disabled = isVeg;
        if (tooltipSpan) tooltipSpan.textContent = isVeg ? "Not available on a Vegetarian Run." : defaultTooltips[id];
        btn.style.opacity = isVeg ? '0.4' : '';
    });
}

// No Save mode: the Save button itself is what lets a player bank a safe
// checkpoint before a risky choice and reload it if things go badly — this
// removes that specific safety net for the run. It does NOT touch
// persistGamblingState()'s existing silent auto-saves (those already exist
// to LOCK IN gambling/theft outcomes the instant they resolve, which is the
// opposite of a reloadable checkpoint, so they're no contradiction here).
function applyNoSaveButtonLock() {
    const btn = document.getElementById('save-button');
    if (!btn) return;
    const isNoSave = wagon && wagon.challengeMode === 'nosave';
    btn.disabled = isNoSave;
    btn.title = isNoSave
        ? "No Save Mode: you committed to this run the moment you started it. No backsies."
        : "Preserve this moment. You may want to undo it later.";
    btn.style.opacity = isNoSave ? '0.4' : '';
}

function updateLudditeStoreBanner() {
    const header = document.querySelector('#store .store-header');
    if (!header) return;
    const existing = header.querySelector('.luddite-banner');
    if (existing) existing.remove();
    if (pendingChallengeMode === 'luddite') {
        header.insertAdjacentHTML('beforeend',
            `<p class="luddite-banner" style="color:#a0785a; border:1px dashed #a0785a; padding:6px; font-size:0.9em; margin-top:8px;">
                🪓 Luddite Run: stock up carefully. This is the only store you'll ever see — every fort after this refuses to sell you anything factory-made.
            </p>`);
    } else if (pendingChallengeMode === 'ramsey') {
        header.insertAdjacentHTML('beforeend',
            `<p class="luddite-banner" style="color:#6db36d; border:1px dashed #6db36d; padding:6px; font-size:0.9em; margin-top:8px;">
                💵 Dave Ramsey Mode: half the bankroll, all of the discipline. Beans and rice, rice and beans — you have no business buying anything you can't afford twice.
            </p>`);
    }
}

function updateStoreUnitPrices() {
    const c = document.getElementById('clothing-unit-price');
    const f = document.getElementById('firewood-unit-price');
    const o = document.getElementById('oxen-unit-price');
    if (c) c.innerHTML = `$${clothingUnitPrice().toFixed(2)}${clothingUnitPrice() > 10 ? ' <span style="color:#b30000; font-size:0.8em;">(winter demand)</span>' : ''}`;
    if (f) f.innerHTML = `$${firewoodUnitPrice().toFixed(2)}${firewoodUnitPrice() > 1 ? ' <span style="color:#b30000; font-size:0.8em;">(winter demand)</span>' : ''}`;
    if (o) o.innerHTML = `$${draftAnimalUnitPrice().toFixed(2)}`;

    const clothingRow = document.getElementById('clothing-fields');
    const clothingInput = clothingRow ? clothingRow.querySelector("input[name='clothing']") : null;
    if (clothingRow && clothingInput) {
        const isNudist = wagon && wagon.challengeMode === 'nudist';
        clothingInput.value = isNudist ? 0 : clothingInput.value;
        clothingInput.disabled = isNudist;
        clothingInput.max = isNudist ? 0 : 50;
        clothingRow.style.opacity = isNudist ? '0.4' : '';
        clothingRow.title = isNudist ? "Nudist Run: no clothing purchases, ever." : clothingRow.title;
    }
}

let pendingChallengeMode = null; // set between menu click and wagon creation

function startWinterChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'winter';
    toggleModal("#myModal");
    applyNudistProfessionLock();
    applyNewGamePlusUnlock();
    fadeOutIn("#start", "#characterInput");
}

function startNudistChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'nudist';
    toggleModal("#myModal");
    applyNudistProfessionLock();
    applyNewGamePlusUnlock();
    fadeOutIn("#start", "#characterInput");
}

function startLudditeChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'luddite';
    toggleModal("#myModal");
    applyNudistProfessionLock();
    applyNewGamePlusUnlock();
    fadeOutIn("#start", "#characterInput");
}

function startVegetarianChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'vegetarian';
    toggleModal("#myModal");
    fadeOutIn("#start", "#characterInput");
}

function startRamseyChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'ramsey';
    toggleModal("#myModal");
    fadeOutIn("#start", "#characterInput");
}

function startNoSaveChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'nosave';
    toggleModal("#myModal");
    fadeOutIn("#start", "#characterInput");
}

function gamblingBlocked() {
    return wagon && wagon.challengeMode === 'ramsey';
}


function applyNudistProfessionLock() {
    const tailorRadio = document.querySelector("input[name='profession'][value='Tailor']");
    if (!tailorRadio) return;
    const label = tailorRadio.closest('div');
    if (pendingChallengeMode === 'nudist') {
        tailorRadio.disabled = true;
        tailorRadio.checked = false;
        if (label) { label.style.opacity = '0.4'; label.title = "Not available in Nudist Run — no clothes means no tailoring."; }
        const bankerRadio = document.querySelector("input[name='profession'][value='Banker']");
        if (bankerRadio) bankerRadio.checked = true;
    } else {
        tailorRadio.disabled = false;
        if (label) { label.style.opacity = ''; label.title = ''; }
    }
}

function makeHouseGhost(route, name, dailyPace) {
    const target = RouteDistances[route] || 2000;
    const cycle = [1.05, 1.15, 0.95, 1.1, 0.9, 1.2, 0]; // day 7 = rest
    const log = [0];
    let dist = 0, day = 0;
    while (dist < target && day < 400) {
        day++;
        dist += dailyPace * cycle[(day - 1) % 7];
        log.push(Math.round(Math.min(dist, target)));
    }
    return { route, days: day, name, recordedAt: "house", log };
}

const BUILTIN_GHOSTS = {};
[
    ["Oregon",      "The Pale Rider",        18],
    ["California",  "Donner's Shadow",       18],
    ["Mormon",      "The Handcart Wraith",   17],
    ["Santa Fe",    "The Turquoise Ghost",   17],
    ["Bozeman",     "Bulletproof Pete's Shade", 16],
    ["UNO Reverse", "Redir Elap Eht",        17],
].forEach(([route, name, pace]) => {
    BUILTIN_GHOSTS[route] = makeHouseGhost(route, name, pace);
});

function ghostStorageKey(route) { return `ot_ghost_${route}`; }

function loadGhostForRoute(route) {
    try {
        const stored = JSON.parse(localStorage.getItem(ghostStorageKey(route)));
        if (stored && Array.isArray(stored.log) && stored.log.length > 1) return stored;
    } catch (e) {}
    return (BUILTIN_GHOSTS[route] && BUILTIN_GHOSTS[route].log.length > 1)
        ? BUILTIN_GHOSTS[route] : null;
}

function saveGhostRun() {
    if (!wagon || !Array.isArray(wagon.ghostLog) || wagon.ghostLog.length < 2) return;
    const route = wagon.route;
    if (!route || route === "Random" || route === "Ironman") return; // random starts make useless ghosts
    const record = {
        route,
        days: wagon.days,
        name: (wagon.characters[0] && wagon.characters[0].name) || "A Phantom",
        recordedAt: new Date().toISOString().slice(0, 10),
        log: wagon.ghostLog.map(d => Math.round(d)),
    };
    try {
        const existing = JSON.parse(localStorage.getItem(ghostStorageKey(route)));
        if (existing && existing.days && existing.days <= record.days) return; // keep the faster one
    } catch (e) {}
    try { localStorage.setItem(ghostStorageKey(route), JSON.stringify(record)); } catch (e) {}
}

window.exportGhostData = function() {
    const out = {};
    Object.keys(RouteDistances).forEach(r => {
        try {
            const g = JSON.parse(localStorage.getItem(ghostStorageKey(r)));
            if (g) out[r] = g;
        } catch (e) {}
    });
    console.log("const BUILTIN_GHOSTS = " + JSON.stringify(out, null, 2) + ";");
    return out;
};

function startGhostRaceChallenge() {
    pendingDailyChallenge = null;
    pendingChallengeMode = 'ghost';
    toggleModal("#myModal");
    applyNudistProfessionLock();
    applyNewGamePlusUnlock();
    fadeOutIn("#start", "#characterInput");
}

// Every planned challenge has shipped. New ideas go here as stubs first.
const CHALLENGE_STUBS = [];

function showChallengesMenu() {
    const content = modalChild;
    const today = utcTodayString();
    const attempted = localStorage.getItem('ot_daily_attempt') === today;

    const dailySection = attempted
        ? `<p style="color:#888; font-size:0.9em;">You've made today's attempt (${today}). A new challenge arrives at midnight UTC.</p>
           <button class="btn btn-info" ${actionAttrs('showLeaderboardUI', ['daily'])}>View Today's Leaderboard</button>`
        : `<p style="color:#ccc; font-size:0.9em;">One attempt. Same seed for every pioneer on Earth today (${today}). Same weather, same events, same fish. Only your choices differ.</p>
           <button class="btn btn-success" ${actionAttrs('startDailyChallenge')}>&#9889; Begin Today's Run</button>
           <button class="btn btn-info" ${actionAttrs('showLeaderboardUI', ['daily'])}>Today's Leaderboard</button>`;

    const stubsHtml = CHALLENGE_STUBS.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding:8px 4px;">
            <div style="text-align:left;">
                <strong style="color:#ddd;">${c.name}</strong><br>
                <small style="color:#777;">${c.desc}</small>
            </div>
            <button class="btn btn-dark btn-sm" disabled title="Coming soon">Soon&#8482;</button>
        </div>
    `).join('');

    content.innerHTML = `
        <div style="background:#000; color:gold; padding: 30px; border: 4px double gold; font-family:'Roboto', sans-serif; text-align:center;">
            <h2 style="font-family:'Rye'; letter-spacing:2px;">--- CHALLENGES ---</h2>
            <div style="border:2px solid gold; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#ffd700; margin-top:0;">&#128197; Daily Challenge</h3>
                ${dailySection}
            </div>
            <div style="border:2px solid #9be7ff; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#9be7ff; margin-top:0;">&#128123; Ghost Race</h3>
                <p style="color:#ccc; font-size:0.9em;">Race the phantom of the fastest finished run on your route &mdash; yours, or the house ghost. Beat it to the destination.</p>
                <p style="color:#888; font-size:0.8em;">${Object.keys(RouteDistances).map(r => `${r}: ${loadGhostForRoute(r) ? '&#128123; ' + loadGhostForRoute(r).days + 'd' : '&mdash;'}`).join(' &nbsp;|&nbsp; ')}</p>
                <button class="btn btn-info" ${actionAttrs('startGhostRaceChallenge')}>Begin Ghost Race</button>
            </div>
            <div style="border:2px solid #6db3d9; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#6db3d9; margin-top:0;">&#10052;&#65039; Winter Start</h3>
                <p style="color:#ccc; font-size:0.9em;">Set out in September, racing the snow the whole way. Clothing and firewood cost double &mdash; everyone else had the same idea.</p>
                <button class="btn btn-info" ${actionAttrs('startWinterChallenge')}>Begin Winter Run</button>
            </div>
            <div style="border:2px solid #e8a0bf; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#e8a0bf; margin-top:0;">&#128121; Nudist Run</h3>
                <p style="color:#ccc; font-size:0.9em;">No buying, crafting, or trading for clothes. No Tailor profession. The elements will notice. Reach Oregon anyway and earn the "Nekkid" achievement.</p>
                <button class="btn btn-info" ${actionAttrs('startNudistChallenge')}>Begin Nudist Run</button>
            </div>
            <div style="border:2px solid #a0785a; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#a0785a; margin-top:0;">&#129686; Luddite Run</h3>
                <p style="color:#ccc; font-size:0.9em;">Independence is the only store you'll ever see. No fort purchases after you leave &mdash; whatever you need from then on, you gather, hunt, and craft with your own hands. Selling, trading, and gambling are still fair game; buying manufactured goods is not.</p>
                <button class="btn btn-info" ${actionAttrs('startLudditeChallenge')}>Begin Luddite Run</button>
            </div>
            <div style="border:2px solid #6fae6f; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#6fae6f; margin-top:0;">&#127807; Vegetarian</h3>
                <p style="color:#ccc; font-size:0.9em;">No hunting, no fishing. Whatever your party eats, it grew in the ground first. The Hunt and Fish buttons are locked for the whole run &mdash; buy, gather, and craft your way to Oregon instead.</p>
                <button class="btn btn-info" ${actionAttrs('startVegetarianChallenge')}>Begin Vegetarian Run</button>
            </div>
            <div style="border:2px solid #6db36d; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#6db36d; margin-top:0;">&#128181; Dave Ramsey Mode</h3>
                <p style="color:#ccc; font-size:0.9em;">Half the starting cash of a normal run, a written budget, and absolutely no gambling &mdash; the saloon doors are closed to you at every fort. Beans and rice, rice and beans, all the way to Oregon. Debt-free scream at the finish line.</p>
                <button class="btn btn-info" ${actionAttrs('startRamseyChallenge')}>Begin Dave Ramsey Mode</button>
            </div>
            <div style="border:2px solid #c0392b; border-radius:8px; padding:16px; margin: 20px 0;">
                <h3 style="color:#e05a4a; margin-top:0;">&#128274; No Save</h3>
                <p style="color:#ccc; font-size:0.9em;">The Save button is locked for the whole run. Whatever happens out there &mdash; a death, a bad trade, a wrong turn &mdash; you live with it instead of reloading around it. Close the tab and you're trusting whatever the game happened to auto-save last, not a checkpoint you picked. Reach Oregon anyway and earn "No Scummin'."</p>
                <button class="btn btn-info" ${actionAttrs('startNoSaveChallenge')}>Begin No Save Run</button>
            </div>
            ${stubsHtml}
            <div style="margin-top:20px;">
                <button class="btn btn-danger" ${actionAttrs('toggleModal', ['#myModal'])}>Back</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function startDailyChallenge() {
    const today = utcTodayString();
    if (localStorage.getItem('ot_daily_attempt') === today) {
        updateActionPrompt("You've already made today's attempt. Come back tomorrow.");
        return;
    }
    // The attempt is consumed at the start -- no restarting a bad run.
    try { localStorage.setItem('ot_daily_attempt', today); } catch (e) {}

    pendingChallengeMode = null;
    pendingDailyChallenge = today;
    enableDailyChallengeRNG(hashDailySeed(today));

    toggleModal("#myModal");
    applyNudistProfessionLock();
    applyNewGamePlusUnlock();
    fadeOutIn("#start", "#characterInput");
}

// Central switch for all WebSpeech narration. Persisted so the preference survives reloads. speakHint() checks this before uttering anything.
const SpeechManager = {
    enabled: (function() {
        try { return (localStorage.getItem('otSpeechEnabled') ?? 'on') === 'on'; }
        catch (e) { return true; }
    })(),
    lastText: "",
    lastAt: 0,
    toggle: function() {
        this.enabled = !this.enabled;
        try { localStorage.setItem('otSpeechEnabled', this.enabled ? 'on' : 'off'); } catch (e) {}
        if (!this.enabled) stopSpeaking();
        this.updateButton();
    },
    updateButton: function() {
        const btn = document.getElementById('speech-button');
        if (btn) btn.textContent = this.enabled ? '🗣️ Speech: On' : '🗣️ Speech: Off';
    }
};

function speakHint(text) {
    if (!window.speechSynthesis || !SpeechManager.enabled) return;

    // Callers may pass strings containing markup (anything routed through translateSanity at render time) — never read HTML tags aloud.
    const plain = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return;

    const now = Date.now();
    if (plain === SpeechManager.lastText && now - SpeechManager.lastAt < 2500) return;
    SpeechManager.lastText = plain;
    SpeechManager.lastAt = now;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plain);
    const voices = window.speechSynthesis.getVoices();

    // TIERED SEARCH: Look for 'Natural', then 'Google', then 'Male'
    // 'Natural' voices (like those in Edge or Chrome) sound significantly more human.
    let bestVoice = voices.find(v => v.name.includes('Microsoft Mark')) ||
                    voices.find(v => v.name.includes('Natural') && v.lang.includes('en-US')) ||
					voices.find(v => v.name.includes('Google US English')) ||
                    voices.find(v => v.name.includes('Male')) ||
                    voices[0];

    utterance.voice = bestVoice;

    utterance.pitch = 0.45; 
    utterance.rate = 0.75;  
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function buildRiverModal(loc) {
    AudioManager.playSound('rivercrossing');
	const conditions = getRiverConditions(loc.name);
    const data = RiverData[loc.name];
    const content = modalChild;
    
    if (!data) return;

    content.dataset.currentDepth = conditions.depth;
    
    // Explicitly check for true values before rendering buttons
    let buttonsHTML = `
        <button ${actionAttrs('resolveCrossing', ['ford', loc.name])} class="btn btn-info">Ford River</button>
        <button ${actionAttrs('resolveCrossing', ['chevy', loc.name])} class="btn btn-danger">Chevy River</button>
        <button ${actionAttrs('resolveCrossing', ['caulk', loc.name])} class="btn btn-info">Caulk Wagon</button>
    `;
    
    if (data.ferry === true) {
        buttonsHTML += `<button ${actionAttrs('resolveCrossing', ['ferry', loc.name])} class="btn btn-info">Pay for Ferry</button>`;
    }
    if (data.guide === true) {
        buttonsHTML += `<button ${actionAttrs('resolveCrossing', ['guide', loc.name])} class="btn btn-info">Hire Shoshone Guide</button>`;
    }
    
    buttonsHTML += `
        <button ${actionAttrs('restThenShowRiver', [loc.name])} class="btn btn-warning">Wait</button>
        <button ${actionAttrs('detourRiverAndClose')} class="btn btn-danger">Take a Detour</button>
    `;

    content.innerHTML = `<h3>${loc.name}</h3>
                         <p>Current conditions: ${conditions.width} ft wide and ${conditions.depth} inches deep.</p>
                         <div class="buttons">${buttonsHTML}</div>`;
    
    // Ensure modal is active
    const modal = document.querySelector("#myModal");
    if (!modal.classList.contains('active')) toggleModal("#myModal");
}

const REST_DREAM_CHANCE = 0.28;

const KARMA_GOOD_DREAMS = [
    { text: "You dream of your mother's kitchen back home — the smell of fresh bread carries you gently through the night.", sanity: 6 },
    { text: "In your sleep you see the family waiting on the porch, waving. The trail feels a little shorter for it.", sanity: 6 },
    { text: "You dream of old friends toasting your name at a table you'll return to one day.", sanity: 5 },
    { text: "A dream of a proud smile from someone back home visits you tonight. You wake with fresh resolve.", sanity: 7 },
    { text: "You dream of the letter you'll write when you arrive, and everything you'll finally get to say.", sanity: 5 },
    { text: "Someone you love tells you, in the dream, that they're proud of you. You don't remember who. It doesn't matter.", sanity: 8 },
];

const KARMA_BAD_DREAMS = [
    { text: "You dream of the faces of everyone you've wronged on this trail, lined up, silent. Morning does not come soon enough.", sanity: -6 },
    { text: "Something in the dark of the dream keeps a tally. You don't like the number.", sanity: -7 },
    { text: "You dream you're being chased down the trail by nothing in particular, and losing anyway.", sanity: -5 },
    { text: "You wake in a cold sweat, certain someone was standing over the bedroll a moment ago. No one was.", sanity: -6 },
    { text: "You dream of your own tombstone. The epitaph is unflattering, and worse, accurate.", sanity: -5 },
];

function karmaDreamEvent() {
    const karma = wagon.karma || 0;
    if (Math.random() >= REST_DREAM_CHANCE) return null;

    if (karma >= 50) {
        const pool = KARMA_GOOD_DREAMS.slice();
        const pick = pool[Math.floor(Math.random() * pool.length)];
        wagon.sanity = Math.min(100, wagon.sanity + pick.sanity);
        return pick.text;
    }

    if (karma <= -50) {
        const pool = KARMA_BAD_DREAMS.slice();
        // Personalized nightmares only offered when they'd actually be true.
        if (wagon.flags && wagon.flags.bigfoot_blanket) {
            pool.push({ text: "You dream of the widow whose fur blanket you kept. In the dream, she never stops looking for it.", sanity: -7 });
        }
        if (wagon.flags && wagon.flags.robbed_ghost) {
            pool.push({ text: "You dream of the grave you robbed. This time, it wasn't empty when you left it.", sanity: -8 });
        }
        if (wagon.flags && wagon.flags.cheated) {
            pool.push({ text: "You dream of every card you marked and every die you loaded. In the dream, the dealer finally notices.", sanity: -6 });
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        wagon.sanity = Math.max(0, wagon.sanity + pick.sanity);
        return pick.text;
    }

    return null;
}

function applyRestMethod(method, charId) {
    wagon.rest();
	const charIndex = wagon.characters.findIndex(c => c.id == charId);
    const char = wagon.characters[charIndex];
    const isMedic = hasSkill("Medical");
    const bonus = isMedic ? 2 : 1; //
    const medicMsg = isMedic ? " (Your medical expertise doubles the recovery!)" : ""; //
    let msg = "";

    if (method === 'medicine') {
        if (wagon.medicine > 0) {
            wagon.medicine -= 1;
            char.health = Math.min(100, char.health + (30 * bonus)); //
            if (char.illness.length > 0) char.illness.shift();
            msg = `You administered Morphine. ${medicMsg}`;
            // An Animal Handler stretches the dose to the four-legged crew as well
            if (hasSkill("Animal Handling")) {
                wagon.oxenHealth = Math.min(100, wagon.oxenHealth + 5);
                let animalMsg = " You saved a few drops for the oxen";
                if (wagon.flags && wagon.flags.has_dog) {
                    wagon.dogHealth = Math.min(100, wagon.dogHealth + 5);
                    animalMsg += ` and ${wagon.flags.dog_name || "Buster"}`;
                }
                msg += `${animalMsg}. Your Animal Handling skill knows exactly how much they can take.`;
            }
        } else { msg = "You're out of medicine!"; }
    } 
    else if (method === 'leeches' || method === 'dirt') {
        if (Math.random() < 0.25) {
            const randomName = getRandomIllnessName();
            char.illness.push({ name: randomName, severity: 2 });
            msg = `Disaster! You tried to use ${method}, but ${char.name} contracted ${randomName} instead.`;
        } else {
            const gain = (method === 'leeches' ? 5 : 3) * bonus; //
            char.health = Math.min(100, char.health + gain);
            msg = (method === 'leeches') ? `You have too much blood in you! ${medicMsg}` : `Who needs medicine? Dirt is all around. ${medicMsg}`;
        }
    }
    else if (method === 'salt') {
		char.health = Math.max(0, char.health - 5);
		
        msg = "Salt is valuable, but not to heal wounds. All it does is cause pain.";
		if (char.health < 1) { wagon.killCharacter(charIndex, "Rubbing Salt in Wounds"); }
    } 
    else if (method === 'sleep') {
        char.health = Math.min(100, char.health + (2 * bonus)); //
        msg = `Do you ever have a dream where you see yourself standing in sort of sun-god robes on a pyramid with a thousand naked women screaming and throwing little pickles at you? Is that just me? ${medicMsg}`;
    } 
    else if (method === 'walk') {
        msg = "Walking doesn't provide much rest, but it keeps the legs moving.";
    }

    wagon.statusAdjuster();
    textUpdateUI();
    resolveRestNight(msg);
}

function resolveRestNight(msg) {
    if (wagon.characters.every(c => c.status === "Dead")) return;

    const nightSequence = (wagon.campfireResult === 'fireless') ? startFirelessRest : startCampfireRest;
    nightSequence(() => {
        // Layered on top of whatever the treatment did — a quiet karma
        // consequence that never announces itself as "karma."
        const dream = karmaDreamEvent();
        const fullMsg = dream ? `${msg} ${dream}` : msg;
        if (dream) textUpdateUI(); // the dream adjusted sanity after the earlier refresh — sync the meter

        updateActionPrompt(translateSanity(fullMsg));
        eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
        toggleModal("#myModal");

        // rest() ran out of firewood with books available — now that the rest
        // sequence is over and the modal is closed, it's safe to open the
        // burn-a-book choice.
        if (wagon.flags.pendingBookBurn) {
            triggerBurnBookEvent();
        }
    });
}

// --- Event Logic ---
function triggerBurnBookEvent() {
    wagon.flags.pendingBookBurn = false;
    triggerChoiceEvent({
        title: "The Woodpile is Empty",
        message: `Night falls and there isn't a single stick of firewood left. Your eyes drift to the ${wagon.books} book${wagon.books === 1 ? '' : 's'} in the wagon. Paper burns. Knowledge is technically a renewable resource... right?`,
        choices: [
            {
                text: "Burn a Book 📖🔥",
                action: () => {
                    wagon.books = Math.max(0, wagon.books - 1);
                    AchievementManager.unlock('fahrenheit451', 'Fahrenheit 451');
                    const burnLines = [
                        "The flames consume the book. It burns warm, judgmental, and surprisingly fast.",
                        "You feed literature to the fire. Somewhere, a librarian feels a disturbance.",
                        "The book burns beautifully. You avoid eye contact with your children.",
                    ];
                    const line = burnLines[Math.floor(Math.random() * burnLines.length)];
                    updateActionPrompt(translateSanity(line));
                    eventLog.insertAdjacentHTML('afterbegin', `${line}<br>`);
                    textUpdateUI();
                }
            },
            {
                text: "Shiver in the Dark",
                action: () => {
                    updateActionPrompt(translateSanity("You refuse to burn the books. Your principles are intact. Your extremities are not."));
                    eventLog.insertAdjacentHTML('afterbegin', `You refuse to burn the books and endure a fireless night.<br>`);
                    wagon.firelessNight();
                    textUpdateUI();
                }
            }
        ]
    });
}



function positiveEvent() {
    const log = eventLog;
    const index = Math.floor(Math.random() * wagon.characters.length);
    const char = wagon.characters[index];
    const eventRoll = Math.floor(Math.random() * 35) + 1;
    
    // Default values for standard events
    const smallGold = Math.floor(Math.random() * 15) + 10;
    const medFood = Math.floor(Math.random() * 40) + 30;
	
    let msg = "";
    let subMsg = "";
    if (!wagon.flags) wagon.flags = {};

    if ((wagon.karma || 0) >= 50 && Math.random() < 0.2) {
        AudioManager.playSound('amen');
        wagon.characters.forEach(c => { if (c.status !== "Dead") c.health = Math.min(100, c.health + 20); });
        wagon.sanity = Math.min(100, wagon.sanity + 15);
        wagon.food += 60;
        AchievementManager.unlock('guardian_omen', 'Word Gets Around');
        const guardMsg = "A stranger's wagon pulls alongside yours at dusk. 'Heard about you a few stops back,' they say, and leave a crate of supplies before riding on without asking for anything.";
        updateActionPrompt(translateSanity(guardMsg));
        if (log) log.insertAdjacentHTML('afterbegin', `<span style="color: #00A000;">${guardMsg}</span><br>`);
        return;
    }

    switch (eventRoll) {
        case 1: // Panning vs Fishing
            if (DEBUG) console.log("Positive 1");
			triggerChoiceEvent({
                title: "A Mysterious Shimmer",
				message: "A brilliant, flickering light reflects off the water's surface. It's moving... or is it just the current?",
                choices: [
                    { 
                        text: "Pan for Gold", 
                        action: () => {
                            const gold = hasSkill("Prospecting") ? smallGold * 2 : smallGold;
                            wagon.money += gold;
                            updateActionPrompt(`You found $${gold} in gold flakes!`);
							AudioManager.playSound('gold');
                        }
                    },
                    { 
                        text: "Cast a Line", 
                        action: () => {
                            if (hasSkill("Fishing")) {
                                wagon.food += 100;
                                wagon.sanity = Math.min(100, wagon.sanity + 10);
                                updateActionPrompt("A SHINY POKÉ-FISH! You landed an 'Epic' catch! +100 lbs food.");
								AudioManager.playSound('shiny');
                            } else {
                                AudioManager.playSound('miss');
								if (wagon.professionName === "Gamer") {
                                    updateActionPrompt("Grinding for Shiny POKÉ-FISH is a pain in the butt.");
                                } else {
                                    updateActionPrompt("You splashed the water and the shimmer vanished. You caught exactly zero fish.");
								}
                            }
                        }
                    }
                ]
            });
            break;

        case 2: // Abandoned Wagon
            if (DEBUG) console.log("Positive 2");
			msg = `You come across an abandoned wagon. You wouldn't say the food was fresh, but your spouse once said a similar thing about you.`;
            wagon.food += medFood;
			AudioManager.playSound('spooky');
            {
                const foundWood = Math.floor(Math.random() * 4) + 2;
                wagon.firewood += foundWood;
                subMsg = `You salvaged ${medFood} lbs of questionable jerky and ${foundWood} bundles of firewood.`;
                if (Math.random() < 0.35) {
                    wagon.waterBarrels += 1;
                    wagon.water += Math.floor(WATER_PER_BARREL / 2); // half-full, previous owners drank the rest
                    subMsg += ` There's even an intact water barrel, half full. You choose not to think about why they left it.`;
                }
            }
            break;

        case 3: // Wounded Deer (Gathering Check)
            if (DEBUG) console.log("Positive 3");
			triggerChoiceEvent({
                title: "You found a wounded deer",
				message: "You come across a wounded deer not far from the trail. What do you do?",
                choices: [
                    { 
                        text: "Shoot it", 
                        action: () => {
			                let deerMeat = medFood + 20;
                            let deerMsg = `You found a wounded deer.`;
                            if (hasSkill("Gathering")) {
                                deerMeat += 30;
                                deerMsg += " Your Gathering skill allowed you to harvest every usable scrap.";
                            }
                            wagon.food += deerMeat;
                            adjustKarma(-5);
                            updateActionPrompt(deerMsg + ` Food +${deerMeat} lbs.`);
							AudioManager.playSound('yummy');
                        }
                    },
                    { 
                        text: "Tend to its wounds", 
                        action: () => {
                            if (hasSkill("Animal Handling") || hasSkill("Medical")) {
                                wagon.sanity = Math.min(100, wagon.sanity + 10);
                                adjustKarma(10);
                                updateActionPrompt("You feel good knowing you did a good deed tne deer happily skips off into the woods.");
								AudioManager.playSound('amen');
                            } else {
                                AudioManager.playSound('miss');
								wagon.sanity = Math.min(100, wagon.sanity - 10);
								adjustKarma(3);
								if (wagon.professionName === "Gamer") {
                                    updateActionPrompt("You aren't a vet. Are you trying to farm for karma?");
                                } else {
                                    updateActionPrompt("You don't know what you're doing and the wounded deer isn't fully oooperating. You scared it and maybe hurt it worse.");
								}
                            }
                        }
                    }
                ]
            });
            break;

        case 4: // Wild Fruit (Gathering Check)
            if (DEBUG) console.log("Positive 4");
			AudioManager.playSound('yummy');
			let fruitAmt = 30;
            let fruitMsg = `You find wild fruit. Is it safe? You give it to ${char.name} and they don't die.`;
            if (hasSkill("Gathering")) {
                fruitAmt += 25;
                fruitMsg += " Your expert eyes found the ripest clusters.";
            }
            wagon.food += fruitAmt;
            updateActionPrompt(fruitMsg + ` +${fruitAmt} lbs fruit.`);
            break;

        case 5: // Trade Skill Check
            if (DEBUG) console.log("Positive 5");
			if (hasSkill("Trade")) {
                msg = `You encounter a wagon looking for specific parts. Your sharp negotiating earns a tidy profit.`;
                wagon.money += 40;
                subMsg = `You made $40 on a high-margin trade!`;
				AudioManager.playSound('gold');
            } else {
                msg = `You meet a trader, but you can't agree on a price. You find a $5 bill in the dirt while walking away.`;
                wagon.money += 5;
            }
            break;

        case 6: // Hidden Cache
            if (DEBUG) console.log("Positive 6");
			msg = `You find a hidden cache of supplies that says "NOT AT ALL SUSPICIOUS."`;
            wagon.food += 20;
            wagon.bullets += 20;
            subMsg = `It was actually just a pre-order bonus someone forgot.`;
            break;

        case 7: // Lost Traveler (Survival Check)
            if (DEBUG) console.log("Positive 7");
			if (!wagon.flags.traveler_thankful) {
			    if (hasSkill("Survival")) {
                    msg = `You find a lost traveler. Your Survival skills help you guide them back to the trail.`;
                    wagon.sanity = Math.min(100, wagon.sanity + 10);
                    wagon.flags.traveler_thankful = true;
                    adjustKarma(8);
                    subMsg = `You feel good knowing you helped someone in need. +10 Sanity.`;
                } else {
                    msg = `A lost traveler asks for help. You point at a tree and shrug. They give you a pity-biscuit.`;
                    wagon.food += 5;
                    adjustKarma(-3);
                }
			} else {
                msg = `You come across the lost traveler you helped before. You exchange a specific grip. He gave you a secret token. 'Look for the Square and Compasses in the mountains,' he whispers.`;
                wagon.flags.masonic_handshake = true;
                subMsg = `He thanks you again and offers you $30!`;
				AudioManager.playSound('gold');
            }				
            break;

        case 8: // Union Dues
            if (DEBUG) console.log("Positive 8");
			if (!wagon.flags.union_leader) {
			    triggerChoiceEvent({
                    title: "Union Organization",
                    message: "The other wagon leaders want to unionize. They want YOU to lead them. It's a steady paycheck, but a massive headache.",
                    choices: [
                        { 
                            text: "Accept Leadership", 
                            action: () => {
                                wagon.money += 20;
                                wagon.sanity = Math.max(0, wagon.sanity - 10);
			    				wagon.flags.union_leader = true;
                                if (wagon.professionName === "Gamer") {
                                    updateActionPrompt("You accepted the Guild Master role. Your Discord notifications are now permanently muted. +$20.");
                                } else {
                                    updateActionPrompt("You collected $20 in dues, but spent the night arguing. Sanity decreased.");
                                }
                            }
                        },
                        { 
                            text: "Decline (Focus on Family)", 
                            action: () => {
                                wagon.sanity = Math.min(100, wagon.sanity + 15);
                                updateActionPrompt("You turned down the job. The weight lifted off your shoulders is better than any gold. Sanity increased.");
                            }
                        }
                    ]
                });
			} else {
			    triggerChoiceEvent({
                    title: "Union Demands",
                    message: "The union members demand the devs nerf dysentery. As union leader, you have to negotiate.",
                    choices: [
                        { 
                            text: "Threaten to Strike", 
                            action: () => {
                                if (hasSkill("Trade")) {
									updateActionPrompt("Your Trade skills help you negotiate a favorable deal. They nerf dysntery and give you 3 bottles of medicine.");
									wagon.medicine += 3;
								} else {
									updateActionPrompt("You attempt to play hardball. The devs nerf your sanity instead..");
									wagon.sanity = Math.max(0, wagon.sanity - 20);
								}
                            }
                        },
                        { 
                            text: "Beg the Devs", 
                            action: () => {
                                wagon.sanity = Math.min(100, wagon.sanity + 15);
                                if (wagon.professionName === "Gamer") {
                                    updateActionPrompt("The devs want the game to be challenging but fun. They hear your pleas as a Gamer and give you a Bottle of Medicine.");
									wagon.sanity = Math.max(0, wagon.sanity + 10);
									wagon.medicine += 1;
                                } else {
                                    updateActionPrompt("You are confused. You are driving a wagon to Oregon. You aren't even sure who these supposed devs are or what the word nerf means. You feel like you are going insane.");
									wagon.sanity = Math.max(0, wagon.sanity - 10);
                                }
                            }
                        }
                    ]
                });
			}
            break;

        case 9: // Jesus Follow-up
            if (DEBUG) console.log("Positive 9");
			AudioManager.playSound('amen');
			if (wagon.flags.jesus_took_wheel) {
                if (!wagon.flags.jesus_wine) {            
			        msg = `Jesus feels bad about the wheel incident. He turns your water into wine and gives you loaves and fishes.`;
                    wagon.food += 100;
                    wagon.sanity = Math.min(100, wagon.sanity + 20);
                    subMsg = `Divine intervention yields 100 lbs of food!`;
				    wagon.flags.jesus_wine = true;
				} else {
			        msg = `Jesus refills your wine again. This Jesus guy seems pretty awesome.`;
                    wagon.food += 25;
                    wagon.sanity = Math.min(100, wagon.sanity + 10);
                    subMsg = `Divine intervention yields some more tasty wine!`;
				    wagon.flags.jesus_wine = true;					
				}
                if (jesusImg) jesusImg.style.display = "block";
                if (starImg) starImg.style.display = "block";
                setTimeout(() => {
                    if (jesusImg) jesusImg.style.display = "none";
                    if (starImg) starImg.style.display = "none";
                }, 3000);
            } else {
                msg = `You find a Bible in the road. You feel slightly more pious.`;
                wagon.sanity = Math.min(100, wagon.sanity + 5);
            }
            break;

        case 10: // Ray of Sunshine
            if (DEBUG) console.log("Positive 10");
			msg = `A ray of sunshine hits the wagon. You feel relaxed and blessed.`;
            wagon.sanity = Math.min(100, wagon.sanity + 15);
            subMsg = `Sanity restored by 15%.`;
            break;

        case 11: // Shaman
            if (DEBUG) console.log("Positive 11");
			triggerChoiceEvent({
                title: "The Shaman's Rite",
                message: "A traveling Shaman offers to perform a ritual to 'Sync your Wagon's vibration' with the trail.",
                choices: [
                    { 
                        text: "Accept Blessing", 
                        action: () => {
                            if (hasSkill("Animal Handling")) {
                                wagon.oxenHealth = Math.min(100, wagon.oxenHealth + 30);
                                updateActionPrompt("The ritual was a success! The oxen look like they've been buffed in the latest patch.");
								AudioManager.playSound('horse');
                            } else {
                                wagon.sanity = Math.min(100, wagon.sanity + 10);
                                updateActionPrompt("The sage smoke was relaxing. You feel better, but the oxen just look confused.");
                            }
							wagon.flags.shaman = true;
                        }
                    },
                    { 
                        text: "Politely Decline", 
                        action: () => {
                            updateActionPrompt("You moved on. The Shaman mutters something about 'low-tier playstyles'.");
                        }
                    }
                ]
            });
            break;

        case 12: // Beta-Tester (Gamer Only)
            if (DEBUG) console.log("Positive 12");
			if (wagon.professionName === "Gamer") {
                msg = `You find a thin spot in the map's collision boundaries. It's a Dev Cache!`;
                wagon.money += 50;
                wagon.medicine += 2;
                subMsg = `You found $50 and 2 Med-kits. Thanks, playtesters!`;
            } else {
                msg = `You find a cool rock that looks like a developer's face. You post to Discord about the easter egg you found and someone makes a YouTube video about it.`;
                wagon.sanity = Math.min(100, wagon.sanity + 5);
            }
            break;

        case 13: // Miracle Cure (Medical)
            if (DEBUG) console.log("Positive 13");
			if (hasSkill("Medical")) {
                msg = `Your medical training identifies a patch of rare 'System-Restorer' herbs.`;
                wagon.characters.forEach(c => c.health = Math.min(100, c.health + 10));
                subMsg = `The whole party feels 10% better.`;
            } else {
                msg = `You find some mint. Your breath is great, but your dysentery remains.`;
                wagon.sanity = Math.min(100, wagon.sanity + 2);
            }
            break;

        case 14: // Roadside Repairs (Repair)
            if (DEBUG) console.log("Positive 14");
			if (hasSkill("Repair")) {
                msg = `You fix a fancy carriage's axle. The wealthy owner is impressed.`;
                wagon.money += 60;
                subMsg = `You earned $60 for your professional repairs!`;
            } else {
                msg = `You try to help a broken carriage, but you just make a funny noise. They give you $2 to go away. Your spouse can relate.`;
                wagon.money += 2;
            }
            break;

		case 15: // Good Boy (The Dog)
			if (DEBUG) console.log("Positive 15");
			if (!wagon.flags.has_dog) {
				// Stop standard event prompt advancement and open the custom Naming UI inside the modal
				showDogNamingModal();
				return; // Prevents the main event function from firing its default text template overlay
			} else {
				// Dynamic string matching using their previously chosen name!
				const dName = wagon.flags.dog_name || "Buster";
				
				// This structural setup ensures that if they encounter a dog again, it references the custom name
				openChoicePrompt({
					title: "🐾 Trail Companion",
					message: `You pass by another pioneer family's wagon. ${dName} dashes out and has a grand time playing with their retriever for a spell.`,
					subMessage: `Everyone's spirits were lifted watching them run. Sanity increased.`,
					choices: [
						{ text: "Call him back to the wagon", action: () => {
							wagon.sanity = Math.min(100, wagon.sanity + 10);
							AudioManager.playSound('woof');
							textUpdateUI();
						}}
					]
				});
			}
			break;

        case 16: // Secret Fishing Hole (Fishing)
            if (DEBUG) console.log("Positive 16");
			if (hasSkill("Fishing")) {
                msg = `You spot a legendary ripple in a hidden pond. Time for a Pro-Angler session!`;
                wagon.food += 80;
                subMsg = `You hauled in 80 lbs of 'Epic' rarity fish!`;
				AudioManager.playSound('shiny');
            } else {
                msg = `You see some fish, but you just end up getting your boots wet.`;
                wagon.food += 5;
            }
            break;

        case 17: // Crowdfunded
            if (DEBUG) console.log("Positive 17");
			if (!wagon.flags.selfie) {
			    msg = `A group of settlers recognizes you from your (non-existent) travel blog. They want to contribute!`;
                wagon.bullets += 50;
                if (wagon.challengeMode === 'nudist') {
                    wagon.money += 15;
                    subMsg = `The 'fans' donated 50 bullets and $15 — they know better than to bring you clothes. They pose for a group selfie as one of them spends two-hours drawing out the selfie-sketch (tastefully cropped).`;
                } else {
                    wagon.clothing += 2;
                    subMsg = `The 'fans' donated 50 bullets and 2 sets of clothes. They pose for a group selfie as one of them spends two-hours drawing out the selfie-sketch.`;
                }
			    wagon.flags.selfie = true;
			} else {
			    msg = `You come across a news stand. You see there is a Wagon Wheel Magazine and the 'selfie' you posed for before is on the cover`;
                wagon.money += 20;
                subMsg = `You agree to autograph a few copies and the vendor gives you $20.`;
				AudioManager.playSound('gold');
			}
            break;

        case 18: // Diary Ghost
            if (DEBUG) console.log("Positive 18");
            if (!wagon.flags.found_diary) {
                wagon.flags.found_diary = true;
                wagon.sanity = Math.min(100, wagon.sanity + 10);
                updateActionPrompt("You found a lost ghost diary! Reading the previous traveler's struggles makes yours feel manageable. +10 Sanity.");
            } else {
                wagon.sanity = Math.min(100, wagon.sanity + 5);
                updateActionPrompt("Another page of the ghost diary floats through the air to you. The story continues... +5 Sanity.");
            }
            wagon.showGhost();
            break;

        case 19: // Circus
            if (DEBUG) console.log("Positive 19");
			AudioManager.playSound('circus');
			triggerChoiceEvent({
                title: "The Traveling Circus",
                message: "The colorful tents of a circus appear on the horizon. Where do you spend your time?",
                choices: [
                    { text: "The Clowns", action: () => { updateActionPrompt("The clowns were terrifyingly low-poly. You'll have nightmares, but it was a distraction."); wagon.sanity = Math.min(100, wagon.sanity + 5); }},
                    { text: "The Side-Shows", action: () => { updateActionPrompt("You saw a bearded ox. It was just a wig, but you appreciate the effort."); wagon.sanity = Math.min(100, wagon.sanity + 10); }},
                    { text: "The Animals", action: () => { updateActionPrompt("You watched a bear ride a unicycle. Nature is truly majestic."); wagon.sanity = Math.min(100, wagon.sanity + 15); }}
                ]
            });
            break;

        case 20: // Patch Notes
            if (DEBUG) console.log("Positive 20");
			msg = `You find a letter from 'The Architects.' It says: 'BUFF: Wild berries now spawn with 2x calories.'`;
            wagon.food += 40;
            subMsg = `You feel the hand of the Devs. Food +40 lbs.`;
            break;

        case 21: // Low-Poly Orchard
            if (DEBUG) console.log("Positive 21");
			AudioManager.playSound('yummy');
			msg = `You find an orchard where the fruit looks like low-res spheres.`;
            wagon.food += 30;
            subMsg = `Tastes like 8-bit apples. Food +30 lbs.`;
            break;

        case 22: // Refreshing Cutscene
            if (DEBUG) console.log("Positive 22");
			msg = `The wagon stops for a scenic vista. You are forced to watch a 2-minute unskippable cinematic.`;
            wagon.sanity = Math.min(100, wagon.sanity + 10);
            subMsg = `You feel very cinematic. Sanity +10.`;
            break;

        case 23: // Easter Egg
            if (DEBUG) console.log("Positive 23");
			msg = `You find a literal colorful egg under a bush with a 'TM' symbol on it.`;
            wagon.bullets += 40;
            subMsg = `It was full of ammo! +40 bullets.`;
            break;

        case 24: // Abandoned Laundry
            if (DEBUG) console.log("Positive 24");
            if (wagon.challengeMode === 'nudist') {
                msg = `You find a pile of clean, folded clothes. Someone gave up on the trail, but at least they finished chores.`;
                wagon.firewood += 4;
                subMsg = `You have no use for clothes. You burn the pile for warmth instead — 4 bundles of firewood, free of charge.`;
            } else {
                msg = `You find a pile of clean, folded clothes. Someone gave up on the trail, but at least they finished chores.`;
                wagon.clothing += 3;
                subMsg = `Salvaged 3 sets of fresh threads!`;
            }
            break;

        case 25: // Accidental Alchemy
            if (DEBUG) console.log("Positive 25");
			msg = `You mix random supplies in the back and accidentally create a primitive energy drink.`;
            wagon.characters.forEach(c => c.health = Math.min(100, c.health + 5));
            subMsg = `Everyone feels a strange chemical rush! Health +5.`;
            break;

        case 26: // The "Speedrun" Shortcut
            if (DEBUG) console.log("Positive 26");
			triggerChoiceEvent({
                title: "The Sequence Break",
                message: "You find a section of the cliffside where the textures are flickering. It looks like you could clip through the geometry and skip this entire valley.",
                choices: [
                    { 
                        text: "Attempt the Clip", 
                        action: () => {
                            const successChance = (wagon.professionName === "Gamer" || hasSkill("Survival")) ? 0.7 : 0.4;
                            if (Math.random() < successChance) {
                                const milesSkipped = 50;
								wagon.milesToNextLandmark = Math.max(0, wagon.milesToNextLandmark - milesSkipped);
                                wagon.totalDistance += milesSkipped;
								wagon.flags.glitch = true;
                                if (wagon.professionName === "Gamer") {
									updateActionPrompt(`FRAME PERFECT! You clipped through the mountain and skipped ${milesSkipped} miles and gained 20 new Twitch followers. Speedrun status: GREEN.`);
								} else {
								    updateActionPrompt(`FRAME PERFECT! You clipped through the mountain and skipped ${milesSkipped} miles. Speedrun status: GREEN.`);	
								}
                            } else {
                                if (hasSkill("Repair")) {
									updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. Your wagon and dignity are both injured. Your Repair skill works on the wagon, but not your pride. Health -20.");
								} else {
                                    let randomNumber = Math.floor(Math.random() * 3) + 1;
				                    if (randomNumber === 1) {
								    	if (wagon.wheels > 0) { 
                                            wagon.wheels--;
								    		updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke a wheel and your dignity. Health -20.");
                                            if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                                                AchievementManager.data.stats.partsReplaced.push('wheel');
                                                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                                                }
                                            }
		                                	AchievementManager.save();
                                        } else {
                                            wagon.isStuck = true;
                                        	wagon.brokenPart = 'wheel';
											updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke a wheel and your dignity. And you are stuck. Health -20.");
				                    		subMsg = `A wagon wheel shattered in the flip. You have no spare and now you are stuck.`;
                                        }
				                    } else if (randomNumber === 2) {
                                        if (wagon.tongues > 0) { 
                                            wagon.tongues--;
											updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke a wagon tongue and your dignity. Health -20.");
                                            if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                                                AchievementManager.data.stats.partsReplaced.push('tongue');
                                                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                                                }
                                            }
		                                	AchievementManager.save();
                                        } else {
                                            wagon.isStuck = true;
                                        	wagon.brokenPart = 'tongue';
											updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke a wagon tongue and your dignity. You are stuck! Health -20.");
                                        }
				                    } else {
                                        if (wagon.axles > 0) { 
                                            wagon.axles--;
											updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke an axle and your dignity. Health -20.");
                                            if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                                                AchievementManager.data.stats.partsReplaced.push('axle');
                                                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                                                }
                                            }
		                                	AchievementManager.save();
                                        } else {
                                            wagon.isStuck = true;
                                        	wagon.brokenPart = 'axle';
											updateActionPrompt("CRITICAL COLLISION: You hit the invisible wall. You broke an axel and your dignity. You are stuck! Health -20.");
                                        }
				                    }
								}
								char.health = Math.max(0, char.health - 20);
								if (char.health < 1) { wagon.killCharacter(index, "Trying to Speedrun"); }
                            }
                        }
                    },
                    { 
                        text: "Stay on Path (Glitchless)", 
                        action: () => {
                            wagon.sanity = Math.min(100, wagon.sanity + 10);
                            updateActionPrompt("You chose the 'intended developer experience.' Your conscience is clean. +10 Sanity.");
                        }
                    }
                ]
            });
            break;
	    
        case 27: // The Mysterious Monolith
            if (DEBUG) console.log("Positive 27");
			triggerChoiceEvent({
                title: "The Obsidian Monolith",
                message: "A pitch-black stone slab hums with a frequency that vibrates your teeth. It feels... experimental.",
                choices: [
                    { 
                        text: "Touch the Surface", 
                        action: () => {
                            // The "Resource Swap" Glitch
                            let temp = wagon.food;
                            wagon.food = wagon.bullets;
                            wagon.bullets = temp;
                            updateActionPrompt("ALSO SPRACH ZARATHUSTRA! The stone glowed! Your Food and Bullets counts have been swapped. Chaotic! What even is reality?");
							wagon.sanity = Math.min(100, wagon.sanity - 10);
							wagon.flags.monolith = true;
							AudioManager.playSound('2001');
                        }
                    },
                    { 
                        text: "Offer Tribute", 
                        action: () => {
                            if (wagon.food >= 10) {
								wagon.food = Math.max(0, wagon.food - 10);
                                wagon.characters.forEach(c => c.health = Math.min(100, c.health + 15));
                                updateActionPrompt("You left some salt pork. The Monolith emitted a healing pulse. Party Health +15.");
                            } else {
                                updateActionPrompt("You have no food to offer. The Monolith remains silent.");
                            }
                        }
                    },
                    { 
                        text: "Analyze (Medical)", 
                        action: () => {
                            if (hasSkill("Medical")) {
                                wagon.sanity = Math.min(100, wagon.sanity + 20);
                                updateActionPrompt("You realize it's just a natural thermal vent. The scientific logic calms your mind. +20 Sanity.");
                            } else {
                                updateActionPrompt("It's just a big, scary rock. You feel slightly more confused.");
                            }
                        }
                    }
                ]
            });
            break;
        
        case 28: // The Traveling Bard
            if (DEBUG) console.log("Positive 28");
			triggerChoiceEvent({
                title: "The Tattered Bard",
                message: "A man in a muddy tuxedo is playing a lute by the road. He offers a song for a weary traveler.",
                choices: [
                    { 
                        text: "Listen to a Tale", 
                        action: () => {
                            wagon.daylight = Math.max(0, wagon.daylight - 1);
                            wagon.sanity = Math.min(100, wagon.sanity + 20);
                            updateActionPrompt("His ballad of the 'Great GPU Shortage of 1846' was moving. Time lost, but +20 Sanity.");
                        }
                    },
                    { 
                        text: "Join the Song", 
                        action: () => {
                            if (wagon.professionName === "Gamer") {
                                wagon.money += 25;
                                updateActionPrompt("Your knowledge of 8-bit melodies impressed the passersby! You earned $25 in tips.");
                            } else {
                                updateActionPrompt("You sang off-key. A passing ox looked at you with pity. No money gained.");
                            }
                        }
                    },
                    { 
                        text: "Toss a Coin", 
                        action: () => {
                            if (wagon.money > 0) {
								wagon.daylight = Math.max(0, wagon.daylight - 1);
							    wagon.money -= 1;
                                wagon.sanity = Math.min(100, wagon.sanity - 5);
                                updateActionPrompt("You toss a coin your Witcher. Now you can't get the song out of your head. -5 Sanity.");
							} else {
								wagon.sanity = Math.min(100, wagon.sanity - 10);
								updateActionPrompt("Your are reminded of how penniless your broke ass is. -10 Sanity.");
							}
                        }
                    },
                ]
            });
            break;
        
        case 29: // The "Infinite Water" Glitch
            if (DEBUG) console.log("Positive 29");
			triggerChoiceEvent({
                title: "The Bottomless Well",
                message: "You find a well where the bucket never seems to hit bottom, yet always comes up full of crisp, cool water.",
                choices: [
                    { 
                        text: "Rest the Oxen", 
                        action: () => {
                            wagon.oxenHealth = Math.min(100, wagon.oxenHealth + 30);
                            updateActionPrompt("The oxen drank their fill of the sparkling data-water. Oxen Health +30.");
                        }
                    },
                    { 
                        text: "Bottled Hope", 
                        action: () => {
                            if (hasSkill("Gathering")) {
                                wagon.medicine += 2;
                                updateActionPrompt("You used your gathering skills to properly bottle the mineral water. +2 Med-kits acquired!");
                            } else {
                                wagon.sanity = Math.min(100, wagon.sanity + 10);
                                updateActionPrompt("You drank straight from the bucket. Refreshing! +10 Sanity.");
                            }
                        }
                    },
                    { 
                        text: "Toss a Coin In", 
                        action: () => {
                            if (wagon.money > 0) {
							    if (hasSkill("Gamer")) {
									char.health = Math.max(0, char.health - 15);
                                    updateActionPrompt("This infinite well is a magical portal to the Elemental Plane of Water. Your coin hits a Water Elemental you smacks you!");
									if (char.health < 1) { wagon.killCharacter(index, "Water Elemental"); }
                                } else {
									wagon.money = Math.max(0, wagon.money - 1);
							    	wagon.sanity = Math.min(100, wagon.sanity + 10);
                                    updateActionPrompt("You toss a coin and make a wish. You dream it will come true! +10 Sanity.");
                                }
							} else {
								wagon.sanity = Math.min(100, wagon.sanity - 10);
								updateActionPrompt("Your are reminded of how penniless your broke ass is. -10 Sanity.");
							}
                        }
                    },
                    { 
                        text: "Fish in the Well", 
                        action: () => {
                            if (hasSkill("Fishing")) {
                                wagon.food += 150;
                                updateActionPrompt("You catch countless fish in this infinite well!");
                            } else {
								wagon.sanity = Math.min(100, wagon.sanity - 10);
                                updateActionPrompt("An infinite water source has infinite space between fish. It breaks your brain.");
                            }
                        }
                    },
                ]
            });
            break;
        
        case 30: // The Friendly Ghost
            if (DEBUG) console.log("Positive 30");
			AudioManager.playSound('spooky');
			triggerChoiceEvent({
                title: "The Ghost of '47",
                message: "A transparent pioneer sits on a stump. He doesn't look hostile, just... lonely.",
                choices: [
                    { 
                        text: "Befriend the Lonely Ghost", 
                        action: () => {
                            wagon.sanity = Math.max(0, wagon.sanity + 10);
							wagon.money += 25;
							wagon.food += 50;
                            updateActionPrompt("An infinite afterlife is lonely indeed. The grateful ghost shows you a hidden cache of $25 and 50 lbs of food.");
                            wagon.showGhost();
                        }
                    },
                    { 
                        text: "Rob the Ghost", 
                        action: () => {
                            wagon.flags.robbed_ghost = true;
                            wagon.showGhost();
							if (wagon.professionName === "Gamer") {
                                if (Math.random() < 0.2) {
                                    wagon.money += 50;
                                    updateActionPrompt("LEGACY LOOT! You found a 'Literal Easter Egg' ($50) in the ghost's spectral pockets!");
                                } else {
                                    wagon.sanity = Math.max(0, wagon.sanity - 20);
                                    updateActionPrompt("GHOST CURSE! Your vision fills with static. -20 Sanity.");
                                    wagon.showGhost();
                                }
                            } else {
                                updateActionPrompt("You tried to grab him, but your hands passed right through. He looks offended.");
                            }
                        }
                    },
                    { 
                        text: "Ask for Advice", 
                        action: () => {
                            wagon.flags.ghost_protection = true;
							AchievementManager.unlock('casper', 'Casper');
                            updateActionPrompt("The ghost gives you a glimpse of possible futures. You feel protected from the next disaster.");
                            wagon.showGhost();
                        }
                    },
                ]
            });
            break;
			
        case 31: // Bigfoot/Forest Guardian Encounter
            if (DEBUG) console.log("Positive 31");
			AudioManager.playSound('bigfoot');
			if (wagon.flags.bigfoot_talisman) {
                msg = "The Bigfoot you befriended reappears from the treeline! Your Non-Fungible Talisman begins to glow and heal your party.";
                subMsg = "He recognizes the Talisman and leaves a massive pile of medicinal herbs and fresh berries near your wagon.";
                wagon.food += 100;
                wagon.sanity = Math.min(100, wagon.sanity + 20);
                wagon.characters.forEach(char => {
                    if (char.status !== "Dead") char.health = Math.min(100, char.health + 15);
                });
                
                if (typeof textUpdateUI === "function") textUpdateUI();
                updateActionPrompt(translateSanity("The Forest Guardian nods at you before vanishing into the pines. You feel protected."));
            } else {
                msg = "You feel a benevolent presence watching you from the woods. Or maybe they are just a creepy forest voyeur.";
                subMsg = "You find a cache of supplies left on a stump. You gain 25 lbs of food.";
                wagon.food += 25;
                wagon.sanity = Math.min(100, wagon.sanity + 5);
            }
            break;

        case 32: // Resurrection Event (1-Up or Divine Intervention)
            if (DEBUG) console.log("Positive 32");
			const deadindices = [];
            wagon.characters.forEach((char, index) => {
                if (char.status === "Dead") deadindices.push(index);
            });
        
            if (wagon.professionName === "Gamer") {
                AudioManager.playSound('mario');
				msg = "You found a 1-Up Mushroom hidden in a floating brick!";
                
                if (deadindices.length > 0) {
                    const victimIndex = deadindices[Math.floor(Math.random() * deadindices.length)];
                    const char = wagon.characters[victimIndex];
                    
                    char.status = "Good";
                    char.health = 50; 
                    char.isDead = false;
                    char.causeOfDeath = null;
        
                    subMsg = `EXTRA LIFE: ${char.name} has respawned!`;
                } else {
                    subMsg = "Everyone is already at full lives. The party gained 15% health instead.";
                    wagon.characters.forEach(char => {
                        if (char.status !== "Dead") char.health = Math.min(100, char.health + 15);
                    });
                }
            } else {
                msg = "A divine light shines upon the wagon!";
                AudioManager.playSound('amen');
                const jesusImg = document.getElementById('jesus-image');
                const starImg = document.getElementById('star-image'); 
                if (jesusImg) jesusImg.style.display = "block";
                if (starImg) starImg.style.display = "block";
                
                setTimeout(() => {
                    if (jesusImg) jesusImg.style.display = "none";
                    if (starImg) starImg.style.display = "none";
                }, 3000);
        
                if (deadindices.length > 0) {
                    const victimIndex = deadindices[Math.floor(Math.random() * deadindices.length)];
                    const char = wagon.characters[victimIndex];
                    char.status = "Good";
                    char.health = 50;
                    char.isDead = false;
                    char.causeOfDeath = null;
        
                    subMsg = `MIRACLE: ${char.name} has been raised from the dead!`;
                } else {
                    subMsg = "Your party is blessed with health. Everyone gained 15% health.";
                    wagon.characters.forEach(char => {
                        if (char.status !== "Dead") char.health = Math.min(100, char.health + 15);
                    });
                }
            }

            if (typeof textUpdateUI === "function") textUpdateUI();
            wagon.characters.forEach(char => {
                if (typeof char.healthBar === "function") char.healthBar();
            });
            break;

        case 33: // Dry Driftwood Windfall
            if (DEBUG) console.log("Positive 33");
            {
                let foundWood = Math.floor(Math.random() * 5) + 4; // 4–8 bundles
                msg = `You spot a dry creek bed piled with sun-bleached driftwood.`;
                if (hasSkill("Gathering")) {
                    foundWood += 3;
                    subMsg = `Your Gathering skill turned a quick stop into a proper haul: +${foundWood} firewood bundles, pre-dried by years of desert sun.`;
                } else {
                    subMsg = `You gathered +${foundWood} firewood bundles. Nature's kindling aisle, no checkout line.`;
                }
                wagon.firewood += foundWood;
            }
            break;

        case 34: // Hidden Spring
            if (DEBUG) console.log("Positive 34");
            {
                msg = `You hear it before you see it: a clear, cold spring bubbling out of the rocks.`;
                if (wagon.waterBarrels > 0) {
                    const capacity = wagon.waterBarrels * WATER_PER_BARREL;
                    if (hasSkill("Survival")) {
                        wagon.water = capacity;
                        subMsg = `Your Survival skill found the source pool. Every barrel is filled to the brim with the good stuff — zero squirrels detected.`;
                    } else {
                        const before = wagon.water;
                        wagon.water = Math.min(capacity, wagon.water + 12);
                        subMsg = `You filled up as much as you could carry: +${(wagon.water - before).toFixed(0)} drinks of crisp mountain water.`;
                    }
                    AudioManager.playSound('river');
                } else {
                    subMsg = `With no barrels to fill, everyone just drinks until they slosh. It's a good day anyway. (+3 Sanity)`;
                    wagon.sanity = Math.min(100, wagon.sanity + 3);
                }
            }
            break;

        case 35: // Carmen Sandiego & Waldo (Tracking Check + Karma Branch)
            if (DEBUG) console.log("Positive 35");
            if (hasSkill("Tracking")) {
                triggerChoiceEvent({
                    title: "You Found Waldo",
                    message: "Your Tracking skill leads you off the trail and into a thicket, where you stumble on a rather private interlude: a woman in a red-and-white striped fedora is spending some quality time with a man in an equally distinctive striped sweater and glasses. Carmen Sandiego and Waldo look up, mortified — and for once in his life, somebody actually found Waldo. Carmen straightens her coat first. 'Nobody needs to know about this,' she says. 'Can we agree to keep this between us?'",
                    choices: [
                        {
                            text: "Promise to keep their secret",
                            action: () => {
                                const karma = wagon.karma || 0;
                                if (karma >= 50) {
                                    wagon.money += 50;
                                    adjustKarma(5);
                                    AudioManager.playSound('gold');
                                    updateActionPrompt(translateSanity("Carmen studies your face for a long moment, then relaxes. 'I believe you — word travels, and yours is good.' She presses $50 into your hand before she and Waldo slip back into the brush. (+$50, your word is worth something out here)"));
                                } else if (karma <= -50) {
                                    adjustKarma(-5);
                                    wagon.sanity = Math.max(0, wagon.sanity - 5);
                                    updateActionPrompt(translateSanity("Carmen doesn't buy it for a second. 'Word travels the other way too,' she says coldly. She and Waldo are gone before you can argue — and so, you notice a moment later, is the change from your pocket. (-5 Sanity)"));
                                } else {
                                    updateActionPrompt(translateSanity("Carmen studies you, unconvinced either way, and settles for a curt nod. 'We'll see.' She and Waldo disappear into the brush without another word. Some secrets are their own reward, apparently."));
                                }
                            }
                        },
                        {
                            text: "Demand payment for your silence",
                            action: () => {
                                const karma = wagon.karma || 0;
                                adjustKarma(-10);
                                if (karma <= -50) {
                                    wagon.money += 15;
                                    updateActionPrompt(translateSanity("Carmen almost looks impressed. 'A fellow professional,' she mutters, and tosses you $15 just to make you go away. (+$15)"));
                                } else {
                                    AudioManager.playSound('miss');
                                    wagon.money = Math.max(0, wagon.money - 10);
                                    updateActionPrompt(translateSanity("Carmen Sandiego did not become the world's greatest thief by getting shaken down by amateurs. By the time you notice your pocket is lighter, she and Waldo are long gone. (-$10 — you just got out-hustled)"));
                                }
                            }
                        }
                    ]
                });
            } else {
                msg = `You spot what might be tracks leading off into the brush, but they fade out before you can follow them.`;
                wagon.money += smallGold;
                subMsg = `Whatever — or whoever — made them is long gone. You do find $${smallGold} someone dropped along the trail.`;
                AudioManager.playSound('gold');
            }
            break;
    }

    // Final output and global sanity bump
    if (msg !== "") {
        wagon.sanity = Math.min(100, wagon.sanity + 2);
        updateActionPrompt(translateSanity(msg));
        if (log) log.insertAdjacentHTML('afterbegin', `<span style="color: #00A000;">${msg} ${subMsg}</span><br>`);
    }
}

function neutralEvent() {
    if (Math.random() < 0.15) {
        const currentMiles = Math.floor(wagon.totalDistance);
        const legacyGraves = JSON.parse(localStorage.getItem('oregon_legacy_graves')) || [];
        
        // Find a grave on the same route within a 20-mile window
        const nearbyGrave = legacyGraves.find(g => 
            g.route === wagon.route && 
            Math.abs(g.miles - currentMiles) <= 20
        );

        if (nearbyGrave) {
            // Display your own old character!
            showTombstone(nearbyGrave.name, nearbyGrave.cause, nearbyGrave.date);
        } else {
            // Default to random NPC grave
            showTombstone();
        }
        return;
    }
    const log = eventLog;
    const index = Math.floor(Math.random() * wagon.characters.length);
    const char = wagon.characters[index];
    let msgs = []; 

    if (wagon.sanity < 25) {
        msgs = [
			`${char.name} puts together a corkboard in the back of the wagon with a bunch of random drawings, connected with red string. The oxen are secretly Reptilian Overlords!`,
			`${char.name}, you're turning into a penguin. Stop it.`,
			`Meat. You are made of meat. Tasty, tasty meat.`,
			`This was once a tense journey but you feel so relieved to be freed from the unbearable burden of sanity. Only now do you see things as they truly are.`,
			`Your identical twin approaches you, except you do not have a twin. They ask if you are the doppelgänger or are they? They then look at your children and say that either way, you will both be eating well tonight. And in that moment, they are gone.`,
            `${char.name} discovers they can walk through the wagon walls if they tilt their head at exactly 45 degrees. They spend the night vibrating in place.`,
            `${char.name} finds a hole in the ground. Looking inside, they see the underside of the map, where a thousand tiny sprites are holding up the grass.`,
            `${char.name} insists that the oxen are actually just two developers in a costume. They keep trying to find the zipper.`,
            `${char.name} looks at their hands and screams because they can see the lines of code where their skin should be.`,
            `${char.name} spends the night trying to organize the wagon inventory by the alphabetical order of their childhood fears.`,
            `${char.name} suddenly vanishes from the party status list, only to reappear three miles later floating upside down behind the wagon, t-posing to assert dominance.`,
            `${char.name} tries to eat a biscuit, but it turns into a swarm of digital locusts that fly back into the 'Inventory' menu.`,
            `A faceless traveler asks to join your party. When you say no, they simply fold themselves into a small square and blow away.`,
            `A floating '?' icon appears over an ox. When you click it, the ox just says: 'I am a placeholder for a better life.'`,
            `A ghostly popup menu hovers over the prairie: 'Would you like to delete your sanity to optimize frame rate?' The only available button is 'YES.'`,
            `A giant, low-poly hand reaches down from the sky to adjust a tree. It accidentally knocks over an ox. You pretend you didn't see it.`,
            `A lone pioneer approaches your campfire, looks you dead in the eye, and presses their hand against your computer monitor from the inside.`,
            `A massive "Loading..." bar appears on the horizon. You wait for three hours, but nothing changes. You feel older.`,
            `A massive mouse cursor descends from the sky, hovers over ${char.name} for a terrifying ten seconds, clicks twice, and changes their shirt color to bright neon pink.`,
            `A red 'STAMINA LOW' icon appears over your own head in the real world. You try to eat a sandwich, but your hands are just static.`,
            `A system prompt appears: 'ERROR: USER_SOUL_NOT_FOUND. Retrying...' It never finds it. Are you a Ginger perhaps?`,
            `A voice from the sky booms: 'AUTOSAVING PROGRESS...' but you haven't moved an inch, and your logbook now has pages that haven't happened yet.`,
            `An error log appears on the dirt trail: 'CRITICAL WARNING: WAGON_SOUL_LEAK_DETECTED.' You try to patch it with axle grease, but the grease has no collision physics.`,
            `The background mountains start to peel away like cheap wallpaper, revealing a cold, infinite void behind the map.`,
            `The campfire sparks fly upward and arrange themselves into a perfect, low-poly model of a thumbs-up emoji. It stays there for an hour, judging you.`,
            `The clouds begin to render in wireframe. You can see the vertices of the sky poking through the blue.`,
            `The clouds in the skybox have stopped moving. One of them has a 'Created by Adobe' watermark.`,
            `The distance counter begins ticking backward. The closer you get to the next landmark, the more you realize you are heading back to Independence, Missouri, in 1985.`,
            `The ground beneath the wagon turns into a giant checkerboard. You spend the night wondering if you're a pawn or a knight.`,
            `The horizon violently stutters, and for three minutes, the entire skybox displays a massive, low-res texture of a confused-looking buffalo.`,
            `The oxen stop walking and start talking in perfect Latin about the heat death of the universe.`,
            `The oxen stop walking, turn their heads completely around in a full 360-degree rotation, and whisper: 'You forgot to close the store tab, Dave.'`,
            `The river you are crossing turns into a flowing stream of pure green binary code. ${char.name} scoops up a handful and forgets how to read English.`,
            `The sound of the wagon wheels is replaced by a low-bitrate recording of someone whispering 'There are footprints on the ceiling' over and over.`,
            `The sun begins to flicker like a dying lightbulb. You can hear someone in the sky swearing and looking for a replacement.`,
            `The sun sets in the east. Nobody mentions it because the shadows are still casting from the north.`,
            `The sun stays in the same spot for three days. It starts whispering the names of your ancestors.`,
            `The trail ahead begins to loop perfectly. You have passed the same skeleton with a 'Hello My Name Is Brian' tag six times in ten minutes.`,
            `The wind sounds like a thousand people typing on mechanical keyboards. The clicking is deafening.`,
            `The wind whispers a localized string of text: 'undefined is not a function.' Suddenly, ${char.name} loses the ability to bend their knees.`,
            `You check your ammo supply, but the bullet crates are completely empty except for a small note that reads: 'YOUR CHANCE TO HIT IS AN ILLUSION.'`,
            `You find a campfire that is burning blue. When you touch it, it tastes like strawberries and cold Tuesday mornings.`,
            `You find a door standing alone in the desert. You open it and see your own family sitting in Independence, Missouri, eating dinner without you.`,
            `You find a graveyard where every headstone has your legal name on it. The dates of death are all 'Tomorrow'.`,
            `You find an abandoned wagon where the canvas is a mirror. Looking at it, you see your party is entirely comprised of pixelated oxen, and you are the one pulling them.`,
            `You hear the sound of a child laughing, but the audio is bit-crushed and looping. It's coming from inside the medicine chest.`,
            `You look at the 'Miles to Next Landmark' display. It has changed to 'Miles to the End of Everything.' It is currently 0.`,
            `You look down at your boots and realize they have been replaced by a wireframe mesh. Walking now sounds like a bit-crushed snare drum.`,
            `You look into the water and realize your reflection has a different inventory than you do. It looks better geared.`,
            `You pass a mirror in the middle of the desert. Your reflection is already at the next landmark, waving goodbye.`,
            `You pass a tree where the leaves are just static rectangles. When the wind blows, they make the sound of dial-up internet.`,
        ];
    } 
    else if (wagon.professionName === "Gamer") {
        msgs = [
		    `You see a Mackinaw Trout. Do you Eat, Ignore, or Deep-Sea-Research? You chose Ignore. It was actually a pre-rendered sprite. You feel slightly more intelligent.`,
		    `A Troggle appears and tries to eat your wagon's math! Fortunately, your family knows that 12 + 5 is a prime number. The Troggle leaves in confusion.`,
		    `The game's music suddenly changes to a high-tempo boss theme. Everyone looks around nervously for a health bar, but nothing happens. You were just being pranked by the sound engine.`,
            `You find a 'Skip Tutorial' button carved into a tree. You press it, but it just skips your lunch. You are now 100% more hungry and 0% more informed.`,
            `You encounter a 'Missing Texture' error in a patch of grass. You decide it's just a very futuristic species of neon-pink clover. It hurts to look at.`,
            `A prompt appears asking if you'd like to 'Rate This Journey' on the App Store. You look for a 0-star button, but the screen just flickers mockingly.`,
            `You find a discarded 'Strategy Guide' for the trail. The only advice for this section is 'Try not to die.' You find this both helpful and incredibly condescending.`,
            `The wagon's physics engine glitched for a second. The oxen vibrated at 60fps while the wagon stayed at 30fps. Everyone is a little nauseous.`,
		    `You find a pair of 21st-century sunglasses in the dirt. You put them on. You look incredibly cool, but your 'Perception' stat remains at zero because we are not tracking Perception in this game.`,
		    `${char.name} realizes they are but a character in a video game and has an existential crisis. They really hope you save your game.`,
		    `You find a lootbox in the trail. You open it to find... a slightly smaller, empty box. 'Common Drop,' you sigh.`,
            `You wake up and realize your entire life is just a series of RNG rolls. You try to find the 'Options' menu to turn up your Luck stat, but the slider is jammed at 'Low'.`,
            `${char.name} tries to 'Equip' a cool-looking rock they found. They are disappointed to find it has no stat bonuses and doesn't fit in their inventory slot.`,
            `You find a 'Save Point' glowing in the distance. As you approach, it disappears. It was just a rendering artifact from the sun hitting a discarded bean tin.`,
            `You notice a cloud shaped exactly like a low-resolution 'Creeper.' You spend the next three miles checking the underside of the wagon for TNT.`,
            `The party encounters a group of NPCs with identical faces. You realize the developers got lazy with the character models in this zone.`,
            `You find a hidden 'Easter Egg' behind a bush. It’s an actual egg, but it has a tiny copyright symbol painted on it. You decide not to eat it for legal reasons.`,
            `A message appears: 'Connection to Server Lost.' You panic for a second before remembering this is a single-player journey through a digital wasteland.`,
            `${char.name} spends the afternoon trying to 'Wall-Jump' up a steep cliff. They eventually give up with 0 progress and 100% more bruises.`,
            `You find a 'Speedrun' guide pinned to a tree. It suggests jumping into the river to clip through the map. You decide your current 'Glitchless' run is safer.`,
			`The party encounters a merchant selling 'DLC Costumes.' They are just different colored rags for $50 each.`,
            `You find a 'Health Fountain.' You drink from it, but it just refills your 'Oxygen' meter. You aren't underwater, so this is useless. Maybe a modder will restore the cut content`,
            `The party encounters a group of bandits who are 'T-Posing' to assert dominance. You walk past them easily while they glitch through the floor.`,
            `You find a campfire that allows you to 'Attune' your items. You attune your boots, and now they play a 'Level Up' sound every time you step on a bug.`,
            `${char.name} complains that the trail is too 'Linear.' They try to walk off-map, but hit an invisible wall and a prompt saying 'You cannot go this way yet.'`,
            `You see a legendary golden stag. You try to take a screenshot, but your 'Print Screen' key has been replaced by a physical piece of jerky.`,
            `The party enters a 'Cutscene Zone.' You lose control of your legs and watch yourself walk into a trap in third-person view.`,
            `You find a 'Cheat Code' scratched into a rock: UP, UP, DOWN, DOWN... You perform it, and all the oxen turn into bright pink flamingos. The stats are the same.`,
            `${char.name} finds a 'Legendary' weapon in a chest. It's a spoon with +1 to 'Yogurt Consumption.' It requires level 60 to equip.`,
            `You find a 'Side Quest' marker near a bush. It's just a request to find 10 brown rocks. You ignore it; the rewards are probably trash.`,
            `You notice the shadows are 'Low Quality.' You try to find the Settings menu to turn on Ray Tracing, but your hands don't have a 'Menu' button.`,
            `The party encounters an NPC who only repeats the same three lines of dialogue. You realize you've reached the edge of the 'Developed Content' zone.`,
            `You find a 'Glitched Chest.' You try to open it, but your arm clips through the lid. You gain √-π bullets and a minor headache.`,
            `A message appears in the corner of your vision: 'Durable Wagon Axle (Broken) removed from inventory.' You didn't even know you had a UI.`,
            `You see a 'Save Point' glowing under a tree. You try to use it, but a message says: 'Cannot save while enemies (Social Anxiety) are nearby.`,
            `You notice that ${char.name}'s walking animation is looping too fast. They look like they're moonwalking across the prairie.`,
            `A popup appears: 'New DLC available: Stylish Hats for Oxen ($9.99)'. You look for the 'Close' button, but it's hidden behind a cactus.`,
            `You find a 'Lore Note' on the ground. It explains the complex political history of the river you just crossed. You skip to the last page.`,
            `The background music stutters. You spend the afternoon wondering if your life is running on an integrated graphics card.`,
			`In the distance it looks like there is a UFO hovering over Mount Chilead.`,
			`Kirby shows up out of the blue and swallows ${char.name}. Kirby realizes that ${char.name} has no real skills or abilties and then spits them back out.`,
			`You hear a phantom voice whisper, 'Hey, you. You're finally awake.' You panic and check your inventory, but thankfully you aren't in Skyrim and your salted pork is still there.`,
            `The oxen suddenly gain a massive speed boost. You realize they aren't moving faster—the player just plugged in a controller and is holding down the 'Sprint' button.`,
            `You try to look at the sky, but you can't tilt your head up. The developers clearly didn't implement vertical camera tracking for this zone.`,
            `A localized patch of ground displays an error: 'Z-Fighting detected.' Two layers of dirt are aggressively flickering over each other, trying to decide which one is the true floor.`,
            `A massive text overlay covers the mountains: 'WAVE 1 START.' You draw your weapons and wait for thirty minutes, but it turns out the game just spawned three very angry squirrels.`,
            `${char.name} tries to cook dinner, but a message says: 'Crafting queue full. Estimated time remaining: 4 days, 12 hours.' You are being time-gated by a mobile game layout protocol.`,
            `You notice that the background trees are flat, 2D sprites that dynamically turn to face you whenever you walk past them. The illusion of a forest is shattered.`,
            `A ghost appears and runs exactly three steps ahead of your wagon, perfectly mimicking your path. You realize it's just the replay data from your previous failed run.`,
            `You try to fast-travel to Fort Laramie, but a message states: 'Fast travel is unavailable while your family members are actively judging your logistics.'`,
            `The wind sounds suspiciously like a bit-crushed loop of a mechanical keyboard clicking. Someone in the sky is definitely button-mashing through your dialogue.`,
            `You find a mysterious glowing sword stuck in a rock. You pull it out, but it vanishes from your hands and a prompt appears: 'Item sent to microtransaction stash. Pay $4.99 to retrieve.'`,
            `${char.name} complains that the trail has a 'terrible FOV.' They try to adjust the slider, but it just changes the size of the wagon canvas.`,
            `A prompt asks you to 'Accept Privacy Policy and Terms of Service' before crossing the next river. You scroll to the bottom without reading and click agree. Your soul is now legally owned by the ferryman.`,
            `You see a wild rabbit vibrating at an infinite frequency against a fence post. Its hitboxes are completely stuck in the collision mesh.`,
            `The wagon suddenly jumps ten feet into the air and lands perfectly safely. You hit a weird coordinate rounding error in the terrain's logic path.`,
            `A floating text bubble appears above ${char.name}'s head: '[COMPANION DISLIKED THAT].' You aren't sure what you did, but you feel the immediate sting of numerical disapproval.`,
            `The sun sets instantly, jumping from high noon to pitch black in a single frame. The day-night cycle script just suffered a severe frame skip.`,
        ];				
	} else {
        msgs = [
            `One of your oxen was pregnant and gave birth. The baby died and she is sad, but continues on.`,
            `You get a letter from home. Things are so much better without you there.`,
            `Your party finds a small lake and decides to go for a swim. During the swim you begin to wonder if you are part of a giant human soup.`,
            `You find a small bunny and decide to keep it (not as food, what's wrong with you). You will kiss him and love him and squeeze him and hug him and call him George. Or maybe Reader Rabbit.`,
	    	`You find an abandoned lemonade stand. The weather forecast said it would be sunny, but it’s pouring.`,
	    	`A group of settlers passes you in a horse-drawn carriage with 'Student Driver' and 'My Other Wagon is a Tesla' stickers. They mock your 2-horsepower oxen.`,
            `You find an abandoned 'Influencer' camp. There are thousands of self-portraits painted on stone, but no actual food. You leave before the cringe becomes contagious.`,
            `${char.name} starts narrating the journey in a dramatic, gravelly voice-over. Everyone else is too tired to tell them to shut up.`,
            `${char.name} spends the day in the back of wagon eating paste. It is a way to pass the time I suppose.`,
	    	`${char.name} spends 7 hours straight explaining to you the different types of steam engine trains.`,
	    	`${char.name} sits in a ring of mushrooms for an hour begging the Goblin King to take them away. To everyone's disappointment, the Goblin King never shows up.`,
            `A traveling salesman tries to sell you an NFT of a buffalo. You tell him it’s just a sketch on a leaf. He calls you 'cringe' and vanishes into the fog.`,
	    	`You pass a sign that says 'World's Largest Ball of Twine: 50 miles.' You don't have the daylight to visit, and the missed opportunity weighs heavily on your soul.`,
            `A blue bird lands on the wagon and 'tweets' something about your poor fashion choices. You try to report it for harassment, but the 'Report' button is just a drawing of a rock.`,
            `The wagon wheel makes a squeak that sounds exactly like the first three notes of a Rick Astley song. You are being Rick-rolled by your own logistics.`,
            `${char.name} finds a 'Live, Laugh, Love' sign carved into a buffalo skull. It is the most terrifying thing you have seen all week.`,
            `You pass a tree where someone has carved 'First!' into the bark. You feel a strange, ancient urge to downvote the tree.`,
            `A group of squirrels appears to be holding a very organized trial for a nut thief. You move on quickly; you don't want to be called as a witness.`,
            `The wind whispers your name. Or it might just be the friction from the ungreased axle. Either way, it’s being very judgmental today.`,
            `You find a 'Used Wagon' lot in the middle of nowhere. The salesman is a coyote in a top hat. You politely decline his 'No Money Down' offer.`,
            `${char.name} accidentally starts a 'Philosophy Club.' The first meeting ends in a fistfight over whether the oxen are actually 'pulling' or if the earth is just 'pushing' back.`,
            `You find a message in a bottle in a tiny puddle. It says: 'We've been trying to reach you about your wagon's extended warranty.'`,
            `A localized rain cloud follows ${char.name} for three miles, soaking only them. The rest of the party finds this statistically improbable and hilarious.`,
            `${char.name} finds a 'Wishing Well' that only accepts 5-star reviews. You toss in a pebble and wish for a faster frame rate.`,
            `${char.name} finds a 'Subscription Box' in the dirt. It contains three artisanal rocks and a very confused squirrel.`,
            `A group of travelers passes you going the opposite way. They look much happier and are eating pizza. You consider joining them and then you remember what Missouri is like.`,
            `You find a 'Customer Satisfaction Survey' for the Oregon Trail. You write 'Too much dirt, 2/10' and throw it into the wind.`,
            `${char.name} spends the entire day trying to invent 'Wireless Oxen.' It involves a very long piece of string and a lot of shouting.`,
            `You pass a sign that says 'Now Entering: The Content Desert.' The next 50 miles are literally just the same two bushes over and over.`,
            `A crow follows the wagon for miles, shouting 'LORE! LORE!' every time you pass a landmark.`,
            `You find a 'Self-Help' book titled 'How to Not Die of Dysentery.' Every page is blank except for the last one, which says 'Good Luck.'`,
            `${char.name} discovers a 'Artisinal Gluten-Free' patch of grass. The oxen refuse to eat it because they find it 'Pretentious.'`,
            `${char.name} tries to start a 'Wagon-Pool' lane for faster travel. No one else on the trail understands the concept of commuting.`,
            `You pass a sign that says 'Last Chance for Civilization.' It's followed by a sign 10 feet later that says 'Just Kidding, That was 50 miles ago.'`,
            `A traveling poet offers to read you a 40-page epic about dirt. You politely decline and give him a biscuit to stop talking.`,
            `The wagon hits a bump and ${char.name} accidentally swallows a fly. They spend the afternoon trying to decide if it counts as a meal.`,
            `You find a discarded 'Guide to the West' that is just a collection of drawings of people crying. It’s remarkably accurate.`,
            `You pass a wagon with a sign that says 'Oregon or Bust.' They have already busted. You take a moment to appreciate your functioning axles.`,
            `A prairie dog stands on a rock and watches you pass with an expression of deep, soul-crushing judgment.`,
            `You find a pair of boots that are exactly one size too small. You leave them for the next traveler to be annoyed by.`,
            `${char.name} spends the afternoon trying to whistle the national anthem. They get the middle part wrong every single time.`,
            `The wind blows a tumbleweed directly into the wagon. It is now your unofficial sixth party member. You name it 'Dusty'. Dusty better survive the journey.`,
			`A feral cat comes up and steals ${char.name}'s dinner. Cat can in fact haz cheezeburger.`,
			`You encounter a milestone marker that has been aggressively crossed out and overwritten with: 'Are we there yet?' The paint is fresh.`,
            `The wagon bumps over a rock, causing ${char.name} to drop their map into a mud puddle. It immediately dries into a crisp, completely illegible papier-mâché sculpture.`,
            `You pass a tree entirely decorated with old, discarded leather boots. A sign nearby reads: 'The Shoe Tree: Leave a boot, take a splinter.'`,
            `A group of traveling theater actors performs a passionate dramatic play about the tragic economics of buying too many wagon axles. You feel targeted.`,
            `${char.name} discovers a highly localized echo chamber between two canyon walls. They spend three hours screaming insults at themselves just to hear the land agree.`,
            `You stop to examine a beautiful field of wildflowers, only to realize they smell exactly like wet dog and unwashed laundry. Trail romance is dead.`,
            `A passing pioneer offers to sell you 'Premium Dehydrated Water.' It’s just an empty jar. You admire the hustle, but decline the transaction.`,
            `The wagon is followed for four miles by a single, highly determined wild turkey that refuses to break eye contact with ${char.name}.`,
            `You pass a handmade billboard that reads: 'Hot Salt pork inside! Only 400 miles ahead!' It’s the ultimate psychological cliffhanger.`,
            `${char.name} tries to dry their laundry by hanging it out the back of the moving wagon. It immediately collects three pounds of pure, historical dust.`,
            `You spot a rare, majestic bald eagle soaring through the sky. It lands on a branch, spits out a small piece of salted pork it stole from a nearby camp, and flies away disgusted.`,
            `The wagon axle develops a low, rhythmic hum that matches the exact tempo of your own internal existential dread.`,
            `You find a beautifully carved wooden sign in the middle of a barren desert that simply says: 'Grass.' Someone clearly had a cruel sense of humor.`,
            `${char.name} dedicates an entire afternoon to training a local grasshopper to sit on their shoulder. It jumps away the second the wagon hits a minor pebble.`,
            `You pass an abandoned pioneer campsite where the only remaining artifact is a small wooden plaque that reads: 'Don't talk to me until I've had my morning coffee.'`,
            `A mild gust of wind blows a stranger's formal top hat directly onto the head of your lead ox. He looks incredibly dignified and refuses to let you take it off.`,
            `${char.name} claims they have unlocked the secret to predicting the trail weather by monitoring the specific twitching patterns of their left thumb. It immediately starts pouring rain.`,
            `You pass a wagon traveling backwards. The driver looks completely exhausted and mutters: 'I missed a turn in Ohio and I'm too stubborn to look at a map.'`,
        ];
	}

    const selectedMsg = msgs[Math.floor(Math.random() * msgs.length)];
    if (selectedMsg.includes("Dusty")) {
        wagon.flags.has_dusty = true;
    } else if (selectedMsg.includes("diary")) {
		wagon.flags.found_diary = true;
    } else if (selectedMsg.includes("bunny")) {
		wagon.flags.bunny = true;
	}

    updateActionPrompt(translateSanity(selectedMsg));
    if (log) {
        const color = wagon.sanity < 25 ? "#ff00ff" : "#aaa";
        log.insertAdjacentHTML('afterbegin', `<span style="color:${color};">${selectedMsg}</span><br>`);
    }
}

function negativeEvent() {
    if (!wagon.flags) wagon.flags = {};
	if (wagon.flags.ghost_protection) {
        wagon.flags.ghost_protection = false;
        updateActionPrompt("The Ghost of '47's blessing shielded you from a disaster!");
        wagon.showGhost();
        return; // Skip the negative event logic
    }

    const log = eventLog;
    const index = Math.floor(Math.random() * wagon.characters.length);
    const char = wagon.characters[index];
    const leader = wagon.characters[0];

    // The trail has a long memory for wagons that have left a trail of their own.
    // This only becomes reachable after a sustained pattern of bad behavior.
    if ((wagon.karma || 0) <= -50 && Math.random() < 0.2) {
        AudioManager.playSound('miss');
        const lostFood = Math.min(wagon.food, Math.floor(Math.random() * 30) + 20);
        wagon.food = Math.max(0, wagon.food - lostFood);
        char.health = Math.max(0, char.health - 15);
        AchievementManager.unlock('crooked_trail', 'What Goes Around');
        const omenMsg = `A group of travelers spots your wagon and quietly moves their camp further down the trail. In the night, someone empties your stores anyway. ${char.name} takes a hit trying to stop them. Food -${lostFood} lbs.`;
        updateActionPrompt(translateSanity(omenMsg));
        if (log) log.insertAdjacentHTML('afterbegin', `<span style="color: #ff4444;">${omenMsg}</span><br>`);
        if (char.health < 1) { wagon.killCharacter(index, "Reputation"); }
        return;
    }

    let eventRoll = Math.floor(Math.random() * 30) + 1;

    const HOSTILE_HUMAN_CASES = [9, 25, 26, 30]; // Thief, Cannibals, Bandits, Animal Theft
    if (wagon.flags && wagon.flags.safePassageUntilDay && wagon.days <= wagon.flags.safePassageUntilDay
        && HOSTILE_HUMAN_CASES.includes(eventRoll) && Math.random() < (wagon.flags.safePassageStrength || 0)) {
        do {
            eventRoll = Math.floor(Math.random() * 30) + 1;
        } while (HOSTILE_HUMAN_CASES.includes(eventRoll));
    }

    const PART_BREAKDOWN_CASES = [3, 4, 5, 20]; // Jesus Take the Wheel, Axle, Tongue, Tip Over
    if (wagon.flags && wagon.flags.tunedUntilDay && wagon.days <= wagon.flags.tunedUntilDay
        && PART_BREAKDOWN_CASES.includes(eventRoll) && Math.random() < (wagon.flags.tunedStrength || 0)) {
        do {
            eventRoll = Math.floor(Math.random() * 30) + 1;
        } while (PART_BREAKDOWN_CASES.includes(eventRoll));
    }
    
    let msg = "";
    let subMsg = "";
	let daysLost = 0;

    switch (eventRoll) {
        case 1: // Piranhas
            if (DEBUG) console.log("Negative 1");
			msg = `Your party went for a swim in a lake that turned out to be 40% piranha by volume. You are 25% less meat by volume.`;
			char.health = Math.max(0, char.health - 25);
            subMsg = `${char.name} was nibbled significantly. Health -25.`;
			if (char.health < 1) { wagon.killCharacter(index, "Piranhas"); }
            break;

        case 2: // Vorpal Bunny
            if (DEBUG) console.log("Negative 2");
            msg = `A Vorpal Bunny bites ${char.name}. They now have a 'Social Disease.'`;
            char.illness.push({ name: "Vorpal-Gonorrhea", severity: 2 });
            subMsg = `Seriously, what were they doing with that rabbit? It's a localized glitch in their biological firewalls.`;
            break;

        case 3: // Jesus Take the Wheel
            if (DEBUG) console.log("Negative 3");
			const hasSpare = wagon.wheels > 0;
            const canRepair = hasSkill("Repair");            
            daysLost = 5;
            if (hasSpare) daysLost = 1;
            else if (canRepair) daysLost = 2;
            wagon.days += daysLost;
			wagon.food = Math.max(0, wagon.food - ((wagon.characters.length * 5) * daysLost));
            const jesusImg = document.getElementById('jesus');
            const starImg = document.getElementById('star');
            if (jesusImg) jesusImg.style.display = "block";
            if (starImg) starImg.style.display = "block";

            msg = `${leader.name} jokingly shouts "Jesus, take the wheel!"`;
            
            setTimeout(() => {
                if (jesusImg) jesusImg.style.display = "none";
                if (starImg) starImg.style.display = "none";
            }, 3000);
            
            AudioManager.playSound('jesusWheel');

            if (wagon.wheels > 0) {
                wagon.wheels--;
                wagon.flags.jesus_took_wheel = true;
                subMsg = `Jesus actually appeared, took your physical wagon wheel, and gave it to a family in a more expensive DLC zone. -1 Wheel.`;
                if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                    AchievementManager.data.stats.partsReplaced.push('wheel');
                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                    }
                }
			    AchievementManager.save();
            } else {
                msg = `Jesus actually appeared, took your physical wagon wheel, and gave it to a family in a more expensive DLC zone. -1 Wheel. Unfortunately you do not have a spare and now your wagon is stuck.`;
				wagon.isStuck = true;
				wagon.brokenPart = 'wheel';
            }
            textUpdateUI();
            break;

        case 4: // Axl Rose / Axle
            if (DEBUG) console.log("Negative 4");
			msg = `A loud 'clunk' echoes. Your wagon axle has shattered into a million 'Sweet Child O' Mine' shaped pieces as you hear Axel Rose singing in the distance.`;
			AudioManager.playSound('axel');
            if (hasSkill("Repair")) {
                subMsg = `Your Repair skill allowed you to fix it with some duct tape and a guitar string. No parts lost.`;
                if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                    AchievementManager.data.stats.partsReplaced.push('axle');
                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                    }
                }
			    AchievementManager.save();
            } else if (wagon.axles > 0) {
                wagon.axles--;
                subMsg = `You spent the day replacing it. -1 Axle. 'Welcome to the Jungle,' indeed.`;
                if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                    AchievementManager.data.stats.partsReplaced.push('axle');
                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                    }
                }
			    AchievementManager.save();
            } else {
                subMsg = `You have no spare axles. You're stuck until you can scrounge one!`;
                wagon.isStuck = true;
				wagon.brokenPart = 'axle';
            }
            break;

        case 5: // Broken Tongue
            if (DEBUG) console.log("Negative 5");
			msg = `The wagon tongue snaps! It looks like a giant wooden version of your own tongue after eating too much 'Sour-Patch-Buffalo.'`;
            if (hasSkill("Repair")) {
                subMsg = `Your Repair skill allowed you to "speak in tongues" to fix it with some duct tape and tongue depressers. No parts lost.`;
                if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                    AchievementManager.data.stats.partsReplaced.push('tongue');
                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                    }
                }
			    AchievementManager.save();
            } else if (wagon.tongues > 0) {
                wagon.tongues--;
                subMsg = `You replaced it, but the wagon is still being very quiet. -1 Tongue.`;
                if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                    AchievementManager.data.stats.partsReplaced.push('tongue');
                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                    }
                }
			    AchievementManager.save();
            } else {
                subMsg = `You have no spare tongues! This is a real communication breakdown for the oxen.`;
                wagon.isStuck = true;
                wagon.brokenPart = 'tongue';
            }
            break;

        case 6: // Rotted Food
            if (DEBUG) console.log("Negative 6");
			const rotAmt = Math.min(wagon.food, 50);
            msg = `${rotAmt} lbs of food rotted because ${char.name} wet themselves while napping on the supply crates.`;
			wagon.food = Math.max(0, wagon.food - rotAmt);
            subMsg = `The smell is... avant-garde. Food -${rotAmt} lbs.`;
            break;

        case 7: // Hailstorm
            if (DEBUG) console.log("Negative 7");
			msg = `A sudden hailstorm pummels the trail with ice chunks the size of low-poly boulders.`;
            if (wagon.currentZone <= 2) { // Early zones only
				wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 10);
                subMsg = `The oxen are bruised to hail and back. This is part of the reason you left Missouri. Oxen Health -10.`;
            } else {
                subMsg = `It's just a light sleet here. You're annoyed, but fine.`;
            }
            break;

        case 8: // Lost Trail (Survival/Tracking)
            if (DEBUG) console.log("Negative 8");
			if (hasSkill("Tracking") || hasSkill("Survival")) {
                let reason = hasSkill("Tracking") ? "spotted a broken twig from a previous wagon" : "noted the moss on the north side of the trees";
                updateActionPrompt(`You nearly lost the trail, but you ${reason} and stayed on course.`);
            } else {
                triggerChoiceEvent({
                    title: "Lost in the Pixels",
                    message: "The trail has vanished. Every hill looks like a duplicated asset. How do you proceed?",
                    choices: [
                        { text: "Consult the Map", action: () => { wagon.daylight = Math.max(0, wagon.daylight - 2); updateActionPrompt("It took two hours of arguing over the map, but you found the path. Daylight -2."); }},
                        { text: "Hope and Pray", action: () => { 
                            if (Math.random() > 0.5) { updateActionPrompt("Miraculously, you stumbled back onto the trail!"); }
                            else { wagon.daylight = 0; updateActionPrompt("You wandered in circles until dark. Turn ended."); }
                        }}
                    ]
                });
            }
            break;

        case 9: // Thief (Sharpshooter/Trade)
            if (DEBUG) console.log("Negative 9");
            // A healthy watchdog ends this event before it starts
            if (wagon.flags && wagon.flags.has_dog && wagon.dogHealth > 20) {
                const dName = wagon.flags.dog_name || "Buster";
                AudioManager.playSound('woof');
                msg = `A shadowy figure crept toward your supply crates in the night...`;
                subMsg = `...and was met by ${dName}, teeth bared, absolutely thrilled to finally have a job. The thief fled into the darkness minus one trouser leg. Good dog. (+2 Sanity)`;
                wagon.sanity = Math.min(100, wagon.sanity + 2);
                break;
            }
			triggerChoiceEvent({
                title: "Thief in the Night!",
                message: "A shadowy figure is rummaging through your supply crates! Do you confront them?",
                choices: [
                    { text: "Confront Them", action: () => {
                        if (hasSkill("Sharpshooting")) { updateActionPrompt("You fired a shot into the air. The thief dropped your gear and bolted!"); AudioManager.playSound('shotgun'); }
                        else if (hasSkill("Trade")) { updateActionPrompt("You negotiated a 'Finder's Fee' instead of a robbery. You lost $5 but kept your supplies."); wagon.money = Math.max(0, wagon.money - 5); AudioManager.playSound('gold'); }
                        else { wagon.bullets = Math.max(0, wagon.bullets - 20); char.health = Math.max(0, char.health - 10); updateActionPrompt("The thief pistol-whipped you and escaped with 20 bullets."); if (char.health < 1) { wagon.killCharacter(index, "Pistol Whip"); } }
                    }},
                    { text: "Stay Hidden", action: () => { wagon.food = Math.max(0, wagon.food - 30); updateActionPrompt("You stayed quiet. They made off with 30 lbs of food, but no one was hurt."); }}
                ]
            });
            break;

        case 10: // Snake Bite (Friendly Fire Risk)
            if (DEBUG) console.log("Negative 10");
			triggerChoiceEvent({
                title: "Rattlesnake Alert!",
                message: `A massive rattlesnake is coiled near ${char.name}'s leg!`,
                choices: [
                    { text: "Shoot the Snake", action: () => {
                        if (hasSkill("Sharpshooting")) { updateActionPrompt("A perfect shot! The snake is now a belt."); }
                        else if (Math.random() < 0.3) { 
                            const victim = wagon.characters[Math.floor(Math.random() * wagon.characters.length)];
							victim.health = Math.max(0, victim.health - 20);
                            updateActionPrompt(`You missed the snake and winged ${victim.name}! Friendly fire is 'ON'.`);
                        } else { char.health = Math.max(0, char.health - 30); updateActionPrompt("You missed, and the snake bit anyway! Health -30."); }
						if (char.health < 1) { wagon.killCharacter(index, "Rattlesnake"); }
                    }},
                    { text: "Try to Treat It", action: () => {
                        if (hasSkill("Medical")) { updateActionPrompt("You safely extracted the venom. A close call!"); }
                        else { char.health = Math.max(0, char.health - 40); updateActionPrompt("Your DIY treatment failed. The infection is nasty. Health -40."); if (char.health < 1) { wagon.killCharacter(index, "Rattlesnake"); } }
                    }}
                ]
            });
            break;

        case 11: // Fog
            if (DEBUG) console.log("Negative 11");
			msg = `A heavy fog rolls in. The draw distance is now approximately 4 feet.`;
            wagon.milesToNextLandmark += 5; // Effectively slowing them down
            subMsg = `You moved slower to avoid hitting invisible rocks. +5 miles added to this leg.`;
            break;

        case 12: // Fallen Timbers
            if (DEBUG) console.log("Negative 12");
			msg = `Fallen timbers block the path. It’s a literal 'Level-Gate.'`;
            wagon.daylight = Math.max(0, wagon.daylight - 4); // Lose half a day clearing it
            daysLost = 1;
            wagon.days += daysLost;
			wagon.food = Math.max(0, wagon.food - ((wagon.characters.length * 5) * daysLost));
            subMsg = `You spent hours moving logs.`;
            break;

        case 13: // Missing Member
            if (DEBUG) console.log("Negative 13");
			msg = `${char.name} wandered off to find a 'stronger Wi-Fi signal.' They are lost.`;
            if (hasSkill("Tracking")) {
                subMsg = `You tracked their footprints (and dropped bean-tin trail) and found them in an hour.`;
            } else {
                wagon.daylight = 0;
                daysLost = 1;
                wagon.days += daysLost;
				wagon.food = Math.max(0, wagon.food - ((wagon.characters.length * 5) * daysLost));
                subMsg = `You spent the whole day searching. Turn wasted.`;
				wagon.resourceChecker();
            }
            break;

        case 14: // Stampede
            if (DEBUG) console.log("Negative 14");
			msg = `A buffalo stampede is headed straight for the wagon!`;
            if (hasSkill("Animal Handling")) {
                subMsg = `You whistled a calming frequency that made the buffalo part around the wagon like a red sea.`;
            } else {
				wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 20);
                subMsg = `The wagon was clipped! Oxen Health -20.`;
            }
            break;

        case 15: // Quicksand
            if (DEBUG) console.log("Negative 15");
			msg = `The oxen are sinking into quicksand! The physics engine is confused!`;
            if (hasSkill("Animal Handling") || hasSkill("Survival")) {
                subMsg = `You used a clever lever system to pull them out safely.`;
            } else {
				wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 15);
				wagon.daylight = Math.max(0, wagon.daylight - 3);
                subMsg = `It was an exhausting struggle. Oxen Health -15 and time lost.`;
            }
            break;

        case 16: // Locusts
            if (DEBUG) console.log("Negative 16");
			msg = `Locusts have descended. They ate all the grass and a small portion of your self-esteem.`;
			wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 10);
            subMsg = `The oxen are starving. Oxen Health -10.`;
            break;
			
        case 17: // Zone Specific Disaster
            if (DEBUG) console.log("Processing Zone Disaster for Zone: " + wagon.currentZone);
            const disasters = ["Prairie Fire", "Prairie Fire", "Avalanche", "Dust Storm", "Flash Flood"];
            const disasterIndex = Math.max(0, Math.min(wagon.currentZone - 1, disasters.length - 1));            
            const currentDisaster = disasters[disasterIndex];
            msg = `A localized ${currentDisaster} hits the party!`;
            subMsg = `You lost 10 lbs of food and 10% sanity in the chaos.`;
            wagon.sanity = Math.max(0,   wagon.sanity - 10);
			wagon.food = Math.max(0,   wagon.food - 10);
            break;

        case 18: // Accidental Gunshot
            if (DEBUG) console.log("Negative 18");
			AudioManager.playSound('rifle');
			msg = `While cleaning a rifle, it goes off! 'Safety First' was clearly not the motto today.`;
			char.health = Math.max(0, char.health - 40);
            subMsg = `${char.name} took a bullet to the fleshy bit. Health -40.`;
			if (char.health < 1) { wagon.killCharacter(index, "Accidental Gunshot"); }
            break;

        case 19: // Wagon Fire
            if (DEBUG) console.log("Negative 19");
			msg = `THE WAGON IS ON FIRE! This is what happens when you cook bacon inside the canvas.`;
            if (hasSkill("Survival")) {
                subMsg = `You smothered the flames with dirt before any real damage was done.`;
            } else {
				const woodBurned = Math.min(wagon.firewood, Math.floor(Math.random() * 6) + 5);
				wagon.clothing = Math.max(0, wagon.clothing - 2);
				wagon.food = Math.max(0, wagon.food - 20);
				wagon.firewood = Math.max(0, wagon.firewood - woodBurned);
                subMsg = `You lost 2 sets of clothes and 20 lbs of food to the flames.`;
                if (woodBurned > 0) {
                    subMsg += ` Your firewood stack caught instantly — ${woodBurned} bundles gone. It was, in fairness, extremely good at its one job.`;
                }
            }
            break;

        case 20: // Tip Over
            if (DEBUG) console.log("Negative 20");
			msg = `The wagon hits a rock and tips over! Everything is in the dirt!`;
            if (hasSkill("Repair")) {
                subMsg = `You righted the wagon and fixed the frame instantly. No parts broken.`;
            } else {
                let randomNumber = Math.floor(Math.random() * 3) + 1;
				if (randomNumber === 1) {
                    if (wagon.wheels > 0) { 
                        wagon.wheels--;
						subMsg = `A wagon wheel shattered in the flip. You put on a spare wheel. -1 Wheel.`;
                        if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                            AchievementManager.data.stats.partsReplaced.push('wheel');
                            if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                AchievementManager.unlock('theseus', 'Ship of Theseus');
                            }
                        }
		            	AchievementManager.save();
                    } else {
                        wagon.isStuck = true;
                    	wagon.brokenPart = 'wheel';
						subMsg = `A wagon wheel shattered in the flip. You have no spare and now you are stuck.`;
                    }
				} else if (randomNumber === 2) {
                    if (wagon.tongues > 0) { 
                        wagon.tongues--;
						subMsg = `A wagon tongue shattered in the flip. You put on a spare tongue. -1 Tongue.`;
                        if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                            AchievementManager.data.stats.partsReplaced.push('tongue');
                            if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                AchievementManager.unlock('theseus', 'Ship of Theseus');
                            }
                        }
		            	AchievementManager.save();
                    } else {
                        wagon.isStuck = true;
                    	wagon.brokenPart = 'tongue';
						subMsg = `A tongue shattered in the flip. You have no spare and now you are stuck.`;
                    }
				} else {
                    if (wagon.axles > 0) { 
                        wagon.axles--;
						subMsg = `An axle shattered in the flip. You put on a spare axle. -1 Axle.`;
                        if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                            AchievementManager.data.stats.partsReplaced.push('axle');
                            if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                AchievementManager.unlock('theseus', 'Ship of Theseus');
                            }
                        }
		            	AchievementManager.save();
                    } else {
                        wagon.isStuck = true;
                    	wagon.brokenPart = 'axle';
						subMsg = `An axle shattered in the flip. You have no spare and now you are stuck.`;
                    }
				}
            }
            break;

        case 21: // Toll House
            msg = `You arrive at a gate that says "TOLL HOUSE COOKIES."`;
            if (wagon.money >= 10) {
                wagon.money -= 10;
                wagon.sanity = Math.min(100, wagon.sanity + 10);
                subMsg = `You paid a toll of $10. The cookies were delicious. Sanity +10.`;
            } else {
                wagon.daylight = 0;
                daysLost = 3;
                wagon.days += daysLost;
				wagon.food = Math.max(0, wagon.food - ((wagon.characters.length * 5) * daysLost));
                subMsg = `You couldn't pay the toll. You had to take the long way around. ${daysLost} days lost.`;
            }
            break;

        case 22: // Dust Choking
            if (DEBUG) console.log("Negative 22");
			msg = `${leader.name} is choking on the thick trail dust from the wagons ahead.`;
            if (hasSkill("Medical")) {
                subMsg = `You used a specialized tincture to clear their lungs. No illness.`;
            } else {
                leader.illness.push({ name: "Dust-Lungs", severity: 1 });
                subMsg = `${leader.name} contracted a mild case of Dust-Lungs.`;
            }
            break;

        case 23: // Contaminated Water
            if (DEBUG) console.log("Negative 23");
			msg = `The water at the last spring was contaminated with 'Logic-Blight.'`;
            if (hasSkill("Animal Handling")) {
                subMsg = `You noticed the oxen hesitating and filtered the water. Everyone is safe.`;
            } else {
				wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 15);
                subMsg = `The oxen are sick. Oxen Health -15.`;
                if (wagon.water > 0) {
                    const fouled = Math.min(wagon.water, Math.floor(Math.random() * 8) + 5);
                    wagon.water = Math.max(0, wagon.water - fouled);
                    subMsg += ` Worse, some was already ladled into your barrels before anyone noticed — you dumped ${fouled} drinks' worth of tainted water.`;
                }
            }
            break;

        case 24: // Dick Cheney
            if (DEBUG) console.log("Negative 24");
			msg = `You were accidentally shot by Dick Cheney while he was 'hunting dan quail' behind your wagon.`;
            AudioManager.playSound('shotgun');
			if (hasSkill("Medical")) {
                char.health = Math.max(0, char.health - 20);
                subMsg = `A direct hit! But your Medical skill prevented ${char.name} from dying.`;
				if (char.health < 1) { char.health = 1; }
            } else {
                char.health = Math.max(0, char.health - 55);
                subMsg = `${char.name} took a face full of birdshot. Health -55. Apologize to him immediately!`;
				if (char.health < 1) { wagon.killCharacter(index, "Dick Cheney"); }
            }
            break;

        case 25: // Cannibals
            if (DEBUG) console.log("Negative 25");
			triggerChoiceEvent({
                title: "The Gourmet Club",
                message: "A group of locals gourmets called The Fine Young Cannibals invites you for dinner. They look at your shins with disturbing intensity.",
                choices: [
                    { text: "Fight Them Off", action: () => {
                        adjustKarma(-8);
                        if (hasSkill("Sharpshooting")) { updateActionPrompt("Your firepower convinced them to stick to a vegan diet today. You escaped."); }
                        else { char.health = Math.max(0, char.health - 50); updateActionPrompt("The skirmish was bloody. They took a literal 'pound of flesh'. Health -50."); if (char.health < 1) { wagon.killCharacter(index, "Cannibals"); } }
                    }},
                    { text: "Bribe with Food", action: () => {
                        if (wagon.food >= 100) { wagon.food -= 100; adjustKarma(4); updateActionPrompt("You gave them 100 lbs of deer meat. They look disappointed but let you pass."); }
                        else { updateActionPrompt("You didn't have enough food to satisfy them. The 'Tax' was paid in blood."); char.health = Math.max(0, char.health - 40); if (char.health < 1) { wagon.killCharacter(index, "Cannibals"); } }
                    }},
                    { text: "Run!", action: () => { wagon.oxenHealth = Math.max(0, wagon.oxenHealth - 20); updateActionPrompt("You pushed the oxen to the limit. You escaped, but the animals are exhausted."); }}
                ]
            });
            break;

        case 26: // Bandits
            if (DEBUG) console.log("Negative 26");
			triggerChoiceEvent({
                title: "Highway Robbery",
                message: "Bandits have blocked the trail with a fallen log! 'Toll or Soul, traveler!'",
                choices: [
                    { text: "Pay the Toll ($50)", action: () => {
                        if (wagon.money >= 50) { wagon.money -= 50; updateActionPrompt("They took your gold and let you pass. A costly peace."); }
                        else { updateActionPrompt("You're too broke to pay! They beat you up for wasting their time."); char.health = Math.max(0, char.health - 30); if (char.health < 1) { wagon.killCharacter(index, "Bandits"); } }
                    }},
                    { text: "Charge Through!", action: () => {
                        if (hasSkill("Animal Handling")) { updateActionPrompt("You expertly maneuvered the wagon through the brush, bypassing the ambush!"); }
                        else { 
                            if (hasSkill("Repair")) {
                                if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                                    AchievementManager.data.stats.partsReplaced.push('wheel');
                                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                                    }
                                }
		                    	AchievementManager.save();
                            } else if (wagon.wheels > 0) { 
                                wagon.wheels--;
                                if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                                    AchievementManager.data.stats.partsReplaced.push('wheel');
                                    if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                                        AchievementManager.unlock('theseus', 'Ship of Theseus');
                                    }
                                }
		                    	AchievementManager.save();
                            } else {
                                wagon.isStuck = true;
                            	wagon.brokenPart = 'wheel';
                            }
							char.health = Math.max(0, char.health - 20);
							if (wagon.professionName === "Gamer") {
                                updateActionPrompt("You attempted a Frame-Perfect-Dodge through the log! You and the wagon took damage, but your speedrun timer is still green.");
							} else {
                                updateActionPrompt("You crashed through the log. You broke a wheel and took some lead.");
							}
							if (char.health < 1) {
								wagon.killCharacter(index, "Failed Stunt");
							}
						}
                    }}
                ]
            });
            break;

        case 27: // The Widow's Wrath
            if (DEBUG) console.log("Negative 27");
			if (wagon.flags.bigfoot_blanket) {
                AudioManager.playSound('bigfoot');
				triggerChoiceEvent({
                    title: "REVENGE: The Bigfoot Spouse",
                    message: "A massive, grieving Bigfoot emerges, pointing a trembling finger at the Bigfoot-fur blanket in your wagon. Its eyes are filled with rage and sorrow. What do you do?",
                    choices: [
                        { 
                            text: "Return the Blanket and Apologize", 
                            action: () => {
                                wagon.flags.bigfoot_blanket = false;
                                wagon.sanity = Math.max(0,   wagon.sanity - 10);
                                adjustKarma(20);
                                updateActionPrompt("You return the fur. The spouse wails in grief and retreats into the woods. The air feels heavy.");
                            }
                        },
                        { 
                            text: "Try to Outrun It", 
                            action: () => {
                                if (Math.random() < 0.3) {
                                    adjustKarma(-5);
                                    updateActionPrompt("You managed to floor it and lose the beast in the brush!");
                                } else {
                                    wagon.sanity = Math.max(0,   wagon.sanity - 10);
									const victimIndex = Math.floor(Math.random() * wagon.characters.length);
                                    adjustKarma(-15);
                                    updateActionPrompt("It caught the back of the wagon! A struggle ensued. There is a scream, lots of blood and they take the blanket back.");
									wagon.flags.bigfoot_blanket = false;
                                    wagon.killCharacter(victimIndex, "The Widow's Revenge");
                                }
                            }
                        },
                        { 
                            text: "Try to Reason with the Beast", 
                            action: () => {
                                if (hasSkill("Trade")) {
                                    wagon.sanity = Math.min(100, wagon.sanity + 10);
                                    adjustKarma(-10); // talked your way out, but you're still keeping stolen goods and blaming an innocent man
                                    updateActionPrompt("Using calming tones and gestures, you convince the beast that Dick Cheney was the one that really shot Bigfoot and you meant no harm. It leaves to go hunt down Dick Cheney.");
                                } else {
                                    wagon.sanity = Math.max(0,   wagon.sanity - 10);
									const victimIndex = Math.floor(Math.random() * wagon.characters.length);
                                    adjustKarma(-15);
                                    updateActionPrompt("The Bigfoot seems even more enraged that you would lie about what you did, while you are cuddling up with the Bigfoot-fur blanket. There ia a scream, lots of blood and they take the blanket back.");									
									wagon.flags.bigfoot_blanket = false;
                                    wagon.killCharacter(victimIndex, "The Widow's Revenge");
								}
                            }
                        }
                    ]
                });
            } else {
                // Alternate effect if they don't have the blanket
                msg = "You hear an eerie, mourning howl in the distance.";
                subMsg = "The sound chills your party to the bone. You swear you saw Bigfoot in the distance but none of your party believes you. Everyone knows Bigfoot isn't real. You lose 5% Sanity.";
                wagon.sanity = Math.max(0, wagon.sanity - 5);
            }
            break;

        case 28: // Storm-Soaked Firewood
            if (DEBUG) console.log("Negative 28");
			msg = `A sudden downpour hammers the camp before anyone can cover the supplies.`;
            AudioManager.playSound('thunder');
            if (hasSkill("Survival")) {
                subMsg = `Your Survival instincts had the firewood tarped and the barrels open before the first drop landed. The rain even topped off your water.`;
                if (wagon.waterBarrels > 0) {
                    wagon.water = Math.min(wagon.waterBarrels * WATER_PER_BARREL, wagon.water + 5);
                }
            } else if (wagon.firewood > 0) {
                const soaked = Math.min(wagon.firewood, Math.ceil(wagon.firewood / 2));
                wagon.firewood = Math.max(0, wagon.firewood - soaked);
                subMsg = `Half your firewood (${soaked} bundles) is soaked through. It now produces smoke, hissing, and disappointment — but no fire.`;
            } else {
                subMsg = `You have no firewood to ruin, which is its own kind of sad. Everyone is just... wet.`;
                wagon.sanity = Math.max(0, wagon.sanity - 2);
            }
            break;

        case 29: // Barrel Catastrophe
            if (DEBUG) console.log("Negative 29");
            if (wagon.waterBarrels > 0 && wagon.water > 0) {
                if (Math.random() < 0.5) {
                    // Knocked over
                    const spilled = Math.min(wagon.water, Math.floor(Math.random() * 10) + 8);
                    wagon.water = Math.max(0, wagon.water - spilled);
                    msg = `An ox scratched itself against the wagon and knocked a water barrel off its mount.`;
                    subMsg = `${spilled} drinks' worth of water soaked instantly into the thirsty ground, which did not say thank you.`;
                } else {
                    // Contaminated
                    const fouled = Math.min(wagon.water, Math.floor(Math.random() * 10) + 8);
                    wagon.water = Math.max(0, wagon.water - fouled);
                    msg = `You found a very dead, very confused squirrel floating in one of the water barrels.`;
                    subMsg = `You dumped ${fouled} drinks' worth of squirrel-water. ${char.name} had already filled a canteen from it this morning and is now doing the math.`;
                    if (Math.random() < 0.3) {
                        char.illness.push({ name: "Squirrel Fever", severity: 1 });
                        subMsg += ` The math was bad. ${char.name} has Squirrel Fever.`;
                    }
                }
            } else {
                msg = `You spent an hour convinced you heard water sloshing somewhere in the wagon.`;
                subMsg = `There was no water. There was never any water. The trail plays cruel tricks on the thirsty. (-3 Sanity)`;
                wagon.sanity = Math.max(0, wagon.sanity - 3);
            }
            break;

        case 30: // Animal Theft — risk depends on the REAL species (see DRAFT_ANIMALS),
                 // even though everyone around here insists on calling them "oxen."
            if (DEBUG) console.log("Negative 30");
            {
                const animalCfg = getDraftAnimalConfig(wagon.draftAnimal);
                if (animalCfg.theftChance <= 0) {
                    // Actual oxen: outlaws scope out the herd and lose all interest.
                    msg = `A pair of outlaws creeps toward your team in the moonlight, sizing up the herd...`;
                    subMsg = `...and quietly rides on. Nobody rustles oxen for a quick getaway. Disappointed silence all around.`;
                    break;
                }
                if (wagon.oxen >= 3 && Math.random() < animalCfg.theftChance) {
                    const maxStealable = wagon.oxen - 2; // never drop the team below the game-over floor
                    const stolen = Math.min(maxStealable, Math.floor(Math.random() * 2) + 1);
                    if (stolen > 0) {
                        wagon.oxen -= stolen;
                        msg = `Outlaws crept in under cover of darkness and made off with ${stolen} of your "oxen"!`;
                        subMsg = `Turns out they were actually ${wagon.animalPlural()} the whole time — which explains why they were worth stealing.`;
                    } else {
                        msg = `Outlaws circled your team but couldn't get a rope on a single one.`;
                        subMsg = `Close call. Your family still insists they're oxen.`;
                    }
                } else {
                    msg = `You spot a pair of riders eyeing your "oxen" from a distance.`;
                    subMsg = `They think better of it and ride on. Not tonight.`;
                }
            }
            break;
	
    }

    if (msg !== "") {
        wagon.sanity = Math.max(0, wagon.sanity - 5); // Global sanity hit for negative events
        updateActionPrompt(translateSanity(msg));
		//eventLog.insertAdjacentHTML('afterbegin', `${msg}<br>`);
        if (log) log.insertAdjacentHTML('afterbegin', `<span style="color: #ff4444;">${msg} ${subMsg}</span><br>`);
	}
}

function triggerChoiceEvent(config) {
    const content = modalChild;
    const log = eventLog;
    if (!content) return;

    // Force the modal open if it isn't
    const modal = document.querySelector("#myModal");
    if (modal && !modal.classList.contains('active')) {
        toggleModal("#myModal");
    }

    // Render the Choice UI
    content.innerHTML = `
        <div class="choice-container" style="background: rgba(0,0,0,0.9); padding: 20px; border: 4px solid #ffd700; font-family: 'Londrina Solid'; text-align: center; color: white; min-height: 200px; display: flex; flex-direction: column; justify-content: center;">
            <h2 style="color: gold;">${config.title}</h2>
            <p style="font-family: 'Courier New'; font-size: 1.1em; margin: 20px 0;">${config.message}</p>
            <div class="choice-buttons" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                ${config.choices.map((choice, index) => `
                    <button id="choice-${index}" class="btn btn-warning" style="padding: 10px 20px;" title="Decisions, decisions. This one's probably fine. Probably.">${choice.text}</button>
                `).join('')}
            </div>
        </div>
    `;

    // Bind Actions
    config.choices.forEach((choice, index) => {
        document.getElementById(`choice-${index}`).onclick = () => {
            choice.action();

            if (choice.noResultScreen) return;
            
            const promptEl = document.getElementById("current-event-msg");
            const resultMsg = promptEl ? promptEl.textContent : "Action completed.";
            
            // GAMER SPECIFIC: Determine if the result was a "win" or "loss"
            let gamerQuestMsg = "";
            if (wagon.professionName === "Gamer") {
                const isBad = resultMsg.toLowerCase().includes("lost") || 
                              resultMsg.toLowerCase().includes("failed") || 
                              resultMsg.toLowerCase().includes("died");
                
                gamerQuestMsg = isBad 
                    ? `<div style="color: #ff00ff; font-weight: bold; margin-bottom: 10px; border: 1px solid #ff00ff; padding: 5px; animation: messagePop 0.3s ease-out;">[!] QUEST FAILED: REPUTATION DECREASED</div>`
                    : `<div style="color: #00ffff; font-weight: bold; margin-bottom: 10px; border: 1px solid #00ffff; padding: 5px; animation: messagePop 0.3s ease-out;">[✓] QUEST COMPLETED: +100 XP</div>`;
            }

            // Render the Result Screen
            content.innerHTML = `
                <div style="text-align:center; padding: 20px; background: rgba(0,0,0,0.9); border: 4px solid #ffd700; color: white;">
                    ${gamerQuestMsg}
                    <h3 style="color: gold;">Result</h3>
                    <p style="font-family: 'Courier New'; color: #00A000; margin: 20px 0; font-size: 1.2em;">${resultMsg}</p>
                    <button id="close-choice-result" class="btn btn-success" title="Well, that happened. Onward.">Back to Trail</button>
                </div>
            `;
            
            document.getElementById("close-choice-result").onclick = () => {
                toggleModal('#myModal');
                textUpdateUI();
            };
            
            if (log) log.insertAdjacentHTML('afterbegin', `<span style="color: #ff8800;">[CHOICE] ${resultMsg}</span><br>`);
        };
    });
}

function showTombstone(customName = null, customCause = null, customDate = null) {
    const name = customName || NPC_names[Math.floor(Math.random() * NPC_names.length)];
    const cause = customCause || DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
    const date = customDate || `${wagon.month} ${wagon.day}, ${wagon.year}`;
	const location = wagon.currentLandmark;
	wagon.graveyard.push({ name, cause, date, location });

    // SVG Tombstone Graphic
    const tombstoneSVG = `
        <div style="position: relative; display: inline-block; width: 100%; max-width: 300px; margin: 10px auto;">
            <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(5px 5px 2px black);">
                <path d="M20 240 L180 240 L180 60 Q180 0 100 0 Q20 0 20 60 Z" fill="#777" stroke="#333" stroke-width="3"/>
                <rect x="15" y="230" width="170" height="10" fill="#555" />
                <text x="100" y="45" text-anchor="middle" font-size="20" fill="#444">†</text>
                <text x="100" y="85" text-anchor="middle" font-family="'Rye', serif" font-size="14" fill="#222" font-weight="bold">HERE LIES</text>
                <text x="100" y="115" textLength="140" lengthAdjust="spacingAndGlyphs" text-anchor="middle" font-family="'Courier New'" font-size="13" fill="#111" font-weight="bold">${name.toUpperCase()}</text>
                <line x1="40" y1="130" x2="160" y2="130" stroke="#444" stroke-width="1" />
                <foreignObject x="30" y="145" width="140" height="60">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="color: #222; font-family: 'Courier New'; font-size: 11px; text-align: center; font-weight: bold; line-height: 1.1;">
                        ${translateSanity(cause)}
                    </div>
                </foreignObject>
                <text x="100" y="215" text-anchor="middle" font-family="'Courier New'" font-size="10" fill="#333">${date}</text>
            </svg>
        </div>
    `;

    const choices = [
        { 
            text: "Pay Respects", 
            action: () => {
                wagon.sanity = Math.min(100, wagon.sanity + 2);
                updateActionPrompt(`You took a moment of silence for ${name}. Your faith in humanity is slightly restored. (+2 Sanity)`);
				eventLog.insertAdjacentHTML('afterbegin', `You took a moment of silence for ${name}. Your faith in humanity is slightly restored. (+2 Sanity)<br>`);
                AudioManager.playSound('amen');
            }
        }
    ];

    choices.push({
        text: "Loot the Grave",
        action: () => {
            adjustKarma(-10); // digging up the dead costs you something, win or lose
            if (Math.random() > 0.5) {
                const goldFound = Math.floor(Math.random() * 20) + 10;
                wagon.money += goldFound;
                updateActionPrompt(`LOOT ACQUIRED! You found $${goldFound} and a 'Common' rarity pocket watch. Worth it.`);
                eventLog.insertAdjacentHTML('afterbegin', `LOOT ACQUIRED! You found $${goldFound} and a 'Common' rarity pocket watch. Worth it.<br>`);
                AudioManager.playSound('gold');
            } else {
                wagon.sanity = Math.max(0, wagon.sanity - 10);
                // Trigger a brief "Haunted" visual effect
                document.getElementById('gameMainScreen').style.filter = "sepia(1) hue-rotate(270deg) contrast(150%)";
                setTimeout(() => { document.getElementById('gameMainScreen').style.filter = "none"; }, 2000);
                
                updateActionPrompt(`GHOST CURSE DETECTED! A bit-crushed spirit shrieks at you. (-10 Sanity)`);
                eventLog.insertAdjacentHTML('afterbegin', `GHOST CURSE DETECTED! A bit-crushed spirit shrieks at you. (-10 Sanity)<br>`);
                AudioManager.playSound('spooky');
                wagon.showGhost();
                speakHint("Consider yourself cursed");
            }
        }
    });

    triggerChoiceEvent({
        title: "A Lonely Grave",
        message: `${tombstoneSVG}<br>You find a marker on the side of the trail.`,
        choices: choices
    });
}

function showGraveyardUI() {
    if (!wagon.graveyard) wagon.graveyard = [];
    if (!wagon.flags) wagon.flags = {};
    const graveyardData = wagon.graveyard;
    const content = document.getElementById("modal-dynamic-content") || 
                    document.getElementById("modal-content") || 
                    modalChild;

    if (!content) {
        console.error("UI Error: Modal container not found. Check your HTML IDs.");
        return;
    }

    const canMourn = !wagon.flags.hasMournedThisStop && graveyardData.length > 0;

    let tableHtml = `
        <table class="graveyard-table">
            <thead>
                <tr>
                    <th>Pioneer</th>
                    <th>Cause of Death</th>
                    <th>Location</th>
                </tr>
            </thead>
            <tbody>`;

    if (graveyardData.length === 0) {
        tableHtml += `<tr><td colspan="3" style="text-align:center;">The trail is surprisingly devoid of corpses. For now.</td></tr>`;
    } else {
        graveyardData.forEach(entry => {
            tableHtml += `
                <tr>
                    <td><strong>${entry.name}</strong></td>
                    <td style="color: #aa0000;">${entry.cause || "Unknown Hazards"}</td>
                    <td>${entry.location || "The Open Trail"}</td>
                </tr>`;
        });
    }

    tableHtml += `</tbody></table>`;
    tableHtml += `<div class="modal-actions" style="margin-top: 20px; text-align: center;">`;

    if (canMourn) {
        tableHtml += `
            <button class="btn btn-warning" id="mourn-btn" ${actionAttrs('handleMourning')}>
                Mourn the Dead
            </button>`;
    }
    tableHtml += `
        <button class="btn btn-danger" ${actionAttrs('toggleModal', ['#myModal'])}>
            Back to Trail
        </button>
    </div>`;

    content.innerHTML = tableHtml;

    if (!document.querySelector("#myModal").classList.contains('active')) {
        toggleModal("#myModal");
    }
}

// Separate logic for the Mourning action
function handleMourning() {
    // Boost sanity as a reward for mourning
    const sanityBoost = 15;
    wagon.sanity = Math.min(100, wagon.sanity + sanityBoost);
    wagon.flags.hasMournedThisStop = true;
    AchievementManager.data.stats.tombstonesMourned++;
    if (AchievementManager.data.stats.tombstonesMourned >= 10) {
        AchievementManager.unlock('social_butterfly', 'Social Butterfly');
    }
    AchievementManager.save();
    adjustKarma(2);
    updateActionPrompt(translateSanity("You held a solemn service for your fallen companions. The party feels a sense of closure."));
    if (typeof AudioManager !== 'undefined') AudioManager.playSound('amen');
    showGraveyardUI();
}

function resolveMourning() {
    const roll = Math.random();
    wagon.flags.hasMournedThisStop = true;
    AchievementManager.data.stats.tombstonesMourned++;
    if (AchievementManager.data.stats.tombstonesMourned >= 10) {
        AchievementManager.unlock('social_butterfly', 'Social Butterfly');
    }
    AchievementManager.save();
    
    // Check for the "Baron Von Wagon" Legacy Drop
    const isGamer = (wagon.professionName === "Gamer");
    const hasBaron = wagon.graveyard.some(g => g.name === "Baron Von Wagon");

    if (isGamer && hasBaron && Math.random() < 0.20) {
        // LEGACY DROP: The Literal and Figurative Easter Egg
        wagon.money += 50;
        wagon.sanity = Math.min(100, wagon.sanity + 20);
        AudioManager.playSound('shiny');
        
        updateActionPrompt(translateSanity("SYSTEM: LEGACY_LOOT_DETECTED. Mourning the Baron revealed a 'Literal and Figurative Easter Egg'! You cashed it in for $50."));
		eventLog.insertAdjacentHTML('afterbegin', `SYSTEM: LEGACY_LOOT_DETECTED. Mourning the Baron revealed a 'Literal and Figurative Easter Egg'! You cashed it in for $50.<br>`);
    } 
    else if (roll < 0.10) {
        // GHOSTLY VISITATION (10% chance)
        wagon.sanity = Math.max(0, wagon.sanity - 15);
        AudioManager.playSound('spooky');
        
        const gameScreen = document.getElementById('gameMainScreen');
        gameScreen.style.filter = "invert(100%) contrast(200%)";
        setTimeout(() => { gameScreen.style.filter = "none"; }, 500);

        updateActionPrompt(translateSanity("A bit-crushed specter rises from the digital soil! 'YOU ARE NEXT,' it whispers in MIDI. (-15 Sanity)"));
		eventLog.insertAdjacentHTML('afterbegin', `A bit-crushed specter rises from the digital soil! 'YOU ARE NEXT,' it whispers in MIDI. (-15 Sanity)<br>`);
		speakHint('YOU ARE NEXT');
        wagon.showGhost();
    } else {
        // BASIC MOURNING (Default)
        wagon.sanity = Math.min(100, wagon.sanity + 10);
        AudioManager.playSound('amen');
        updateActionPrompt(translateSanity("You shared a quiet moment of grief. Remembering their struggles makes your own feel lighter. (+10 Sanity)"));
		eventLog.insertAdjacentHTML('afterbegin', `You shared a quiet moment of grief. Remembering their struggles makes your own feel lighter. (+10 Sanity)<br>`);
    }

    textUpdateUI();
    showGraveyardUI(); 
}

// Function to save a player's death to the permanent global registry
function saveLegacyTombstone(epitaph) {
    const legacyGrave = {
        name: wagon.characters[0].name,
        cause: epitaph,
        route: wagon.route,
        miles: Math.floor(wagon.totalDistance),
        date: `${wagon.month} ${wagon.day}, ${wagon.year}`
    };

    let globalGraveyard = JSON.parse(localStorage.getItem('oregon_legacy_graves')) || [];
    globalGraveyard.push(legacyGrave);
    localStorage.setItem('oregon_legacy_graves', JSON.stringify(globalGraveyard));
}

function promptForEpitaph() {
    const content = modalChild;
    const leaderName = wagon.characters[0] ? wagon.characters[0].name : "The Leader";

    content.innerHTML = `
        <div style="text-align: center; background: #000; color: #fff; padding: 20px; border: 4px solid #555;">
            <h2 style="color: red;">YOU HAVE DIED</h2>
            <p>Would you like to leave a message for those who follow?</p>
            <div style="margin: 20px 0;">
                <svg viewBox="0 0 200 120" style="width: 150px;">
                    <path d="M20 120 L180 120 L180 40 Q180 0 100 0 Q20 0 20 40 Z" fill="#555"/>
                    <text x="100" y="50" text-anchor="middle" fill="#222" font-size="12" font-weight="bold">HERE LIES</text>
                    <text x="100" y="75" text-anchor="middle" fill="#000" font-size="14" "max-width=200px" font-weight="bold">${leaderName.toUpperCase()}</text>
                </svg>
            </div>
            <input type="text" id="epitaph-input" placeholder="Enter final words..." maxlength="50" 
                   style="width: 80%; padding: 10px; background: #222; color: #008800; border: 1px solid #555; text-align: center;">
            <div class="buttons" style="margin-top: 20px;">
                <button id="save-epitaph-btn" class="btn btn-success" title="Chisel it in stone. No spellcheck in 1848.">Mark Grave</button>
            </div>
        </div>
    `;

    document.getElementById("save-epitaph-btn").onclick = () => {
        const text = document.getElementById("epitaph-input").value || "Died on the trail.";
        saveLegacyTombstone(text);
        location.reload(); // Restart game after saving
    };
}

// --- UI Utilities ---

function toggleModal(id) {
    // The overnight campfire sequence can't be interrupted — nothing may
    // open, close, or hijack the modal until the party has rested.
    if (typeof restSequenceActive !== "undefined" && restSequenceActive && id === "#myModal") return;
    const el = document.querySelector(id);
    if (el) {
        el.classList.toggle('active');
    }
}

function buildModal(value, message = "The journey continues...") {
    const content = modalChild;
    content.innerHTML = `
        <h3>Event</h3>
        <img src="./img/${value}.jpg" alt="event image" style="width:100%; height:auto;">
        <div id="popup-text" class="ongoing-events">
            <p>${message}</p>
        </div>
        <div class="buttons">
            <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-success">Continue</button>
        </div>
    `;
    
    // Explicitly ensure the modal is visible
    if (!document.querySelector("#myModal").classList.contains('active')) {
        toggleModal("#myModal");
    }
}

function buildEndModal(value, btnID1, btn1Name) {
    AudioManager.playSound('gameover');
	const content = modalChild;
    content.innerHTML = `
        <img src="./img/${value}.jpg" alt="end game" class="end-game" id="end-game">
        <div id="popup-text" class="button-content">
            <div class="buttons">
                <button id="restart-button" class="btn btn-success" title="Round two. The trail remains undefeated.">${btn1Name}</button>
            </div>
        </div>
    `;

    document.getElementById("restart-button").onclick = () => {
        location.reload();
    };

    if (!document.querySelector("#myModal").classList.contains('active')) {
        toggleModal("#myModal");
    }
}

function toggleDisplay(selector) {
    const el = document.querySelector(selector);
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}

function escapeHtmlAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const ACTION_TITLES = {
    acceptCounter: "Shake on it before they realize what they've done.",
    addCashToTrade: "Money talks. Usually it says 'goodbye.'",
    addToBasket: "Adding to cart. The 1848 equivalent of impulse buying.",
    applyRestMethod: "Medicine is mostly guessing with confidence.",
    attemptCraft: "You watched a blacksmith once. How hard can it be?",
    blackjackCheatPeek: "It's only cheating if the dealer's looking.",
    blackjackDouble: "Twice the wager, twice the regret.",
    blackjackHit: "One more card never hurt anyone. Statistically untrue.",
    blackjackInsurance: "The house's favorite word is 'insurance.'",
    blackjackSplit: "Two hands, double the ways to lose.",
    blackjackStand: "Stand pat and pray to the felt gods.",
    cancelTrade: "Walk away. Dignity mostly intact.",
    choosePath: "Two roads diverged, both probably lead to dysentery.",
    clearBasket: "Second thoughts are free. Everything else isn't.",
    closeModalAndRefreshUI: "Close this and pretend it never happened.",
    closeStoreModal: "The shopkeeper watches you leave, judging.",
    completeTradeSession: "Deal done. No refunds, no takebacks, no mercy.",
    confirmBuyback: "One man's junk is another man's slightly cheaper junk.",
    detourRiverAndClose: "The long way round has never killed anyone. Probably.",
    endFishingBattle: "Cut bait and call it a day.",
    endHuntingDay: "The bullets are gone and so is your patience.",
    finalizeCraftingDay: "Down tools. Your masterpiece awaits inspection.",
    finalizeDogAdoption: "A dog is for life, or at least until the next river.",
    finalizeProspecting: "There's gold in them hills. Allegedly. Somewhere.",
    fortTalk: "Everyone at the fort has a story. Most involve dysentery.",
    handleMourning: "Say a few words. Keep them shorter than the trail.",
    jokeTrade: "This can only end in tears or comedy. Possibly both.",
    leaveFortPrompt: "Back to the wilderness, where the fun happens.",
    liarsDiceCallLiar: "Call their bluff. Bet your gut is smarter than you.",
    liarsDiceCheat: "The old prospector won't notice. He's mostly whiskey.",
    liarsDiceRaise: "Raise the stakes. Lower your odds.",
    openBagMenu: "Rummage through your worldly possessions. All twelve of them.",
    openBaitMenu: "Choose your bait. The fish have opinions.",
    openBlackjackTable: "The house always wins. But maybe not THIS time. (It's this time.)",
    openBuybackMenu: "Turn trail trash into cold hard cash.",
    openDiceTable: "Dice: because sometimes cards are too dignified.",
    openFightMenu: "Violence is never the answer. But it is an option.",
    openFortStore: "Everything's overpriced this far from civilization.",
    openInsultDuelTable: "The pen is mightier, but the tongue is meaner.",
    openOfferMenu: "Make an offer they can definitely refuse.",
    openSaloon: "Whiskey, cards, and questionable decisions await.",
    openStealMenu: "Five-finger discount, on the house (literally).",
    openTelegraphOffice: "Reach out and touch someone. By Morse code. Slowly.",
    payTithe: "You can't take it with you. Might as well tithe it.",
    prepareNextHunt: "Reload, resaddle, and try not to get eaten.",
    proceedFromLandmark: "Onward, into whatever fresh disaster awaits.",
    processGlobalNameEntry: "Immortalize yourself. Or your favorite curse word.",
    processScoreNameEntry: "For the record books. Choose your legacy wisely.",
    promptScoreName: "History remembers the bold. And the misspelled.",
    punchGather: "Punch trees for wood. The game logic is not consulted.",
    reloadPage: "Rebirth. Reincarnation. Another crack at the dysentery.",
    renderPokeBattleUI: "Gotta catch... whatever this is.",
    renderTradeUI: "Let the haggling commence.",
    resolveCrossing: "Ford, float, or flail. Pick your poison.",
    resolvePokeTurn: "It's super effective. Or it isn't. Coin flip, really.",
    restThenShowRiver: "Rest up before the river tries to drown you.",
    returnToFortTalk: "Back to mingling with the fine folk of the fort.",
    saveGamerSkills: "Lock in your build. No respec out here.",
    selectCargo: "Choose what's worth carrying to the promised land.",
    setTradeOffer: "Slide your offer across the table. Hold your breath.",
    showLeaderboardUI: "See how badly you stack up against strangers.",
    startDailyChallenge: "One shot. Same seed as every soul on Earth today.",
    startGhostRaceChallenge: "Race a phantom. It cannot tire. You can.",
    startLudditeChallenge: "Reject modernity. Embrace the whittling.",
    startNudistChallenge: "No clothes, no problem, no dignity.",
    startNoSaveChallenge: "Commitment issues need not apply.",
    startOperationGame: "You're basically a doctor if you're confident enough.",
    startPokeBattle: "Roll for initiative, partner.",
    startRamseyChallenge: "Beans and rice, rice and beans, all the way west.",
    startRiverRafting: "White-water rafting: 1848 edition. No helmets.",
    startTelegraphGame: "Type like your wallet depends on it. It does.",
    startVegetarianChallenge: "The animals will remember your mercy. The hunger won't.",
    startWinterChallenge: "Set out in the cold, like the Donners. Bring snacks.",
    switchBait: "The last bait wasn't working. Try disappointing a different fish.",
    takeTollRoad: "Pay the man, or take the scenic near-death route.",
    tradeTalk: "Small talk before the swindling begins.",
    useBagItem: "Rummage, retrieve, and hope it helps.",
    visitBrothel: "Purely for the stimulating conversation, of course.",
    exitBlackjackTable: "Cash out while you still have boots.",
    exitLiarsDiceTable: "Walk away from the dice. They were never your friends.",
    toggleModal: "Close this window. The trail awaits, impatiently.",
    showChallengesMenu: "For when regular suffering isn't enough.",
};

function actionAttrs(action, args = [], { stopPropagation = false, noTitle = false } = {}) {
    const stopAttr = stopPropagation ? ' data-stop-propagation="true"' : '';
    // Auto-inject a joke title unless the caller sets its own (noTitle: true).
    const joke = (!noTitle && ACTION_TITLES[action]) ? ` title="${escapeHtmlAttr(ACTION_TITLES[action])}"` : '';
    return `data-action="${action}" data-args="${escapeHtmlAttr(JSON.stringify(args))}"${stopAttr}${joke}`;
}

function returnToFortTalk(landmarkKey) {
    stopSpeaking();
    buildFortModal(Landmarks[landmarkKey]);
}
function restThenShowRiver(landmarkName) {
    wagon.rest();
    if (wagon.flags.pendingBookBurn) {
        wagon.flags.pendingBookBurn = false;
        eventLog.insertAdjacentHTML('afterbegin', `No firewood tonight, and no time to debate burning literature by the riverbank.<br>`);
        wagon.firelessNight();
    }
    buildRiverModal(Landmarks[landmarkName]);
}
function detourRiverAndClose() {
    detourRiver();
    toggleModal('#myModal');
}
function closeModalAndRefreshUI() {
    toggleModal('#myModal');
    textUpdateUI();
}
function closeStoreModal() {
    toggleDisplay('#store');
    toggleModal('#myModal');
}
function reloadPage() {
    location.reload();
}

const ACTION_HANDLERS = {
    takeTollRoad, startRiverRafting, toggleModal, toggleDisplay, openFortStore,
    openBuybackMenu, fortTalk, confirmBuyback, choosePath, resolveCrossing,
    handleMourning, endHuntingDay, prepareNextHunt, startPokeBattle, openFightMenu,
    openBagMenu, openBaitMenu, endFishingBattle, switchBait, renderPokeBattleUI,
    useBagItem, resolvePokeTurn, applyRestMethod, proceedFromLandmark, saveGamerSkills,
    punchGather, abandonGathering, attemptCraft, finalizeCraftingDay, finalizeProspecting,
    tradeTalk, openOfferMenu, jokeTrade, cancelTrade, addToBasket, addCashToTrade,
    setTradeOffer, clearBasket, renderTradeUI, acceptCounter, completeTradeSession,
    showLeaderboardUI, processGlobalNameEntry, payTithe, selectCargo, finalizeDogAdoption,
    returnToFortTalk, restThenShowRiver, detourRiverAndClose, closeModalAndRefreshUI,
    closeStoreModal, reloadPage, leaveFortPrompt,
    openSaloon, openBlackjackTable, startBlackjack, blackjackHit, blackjackStand,
    blackjackCheatPeek, exitBlackjackTable, openDiceTable, startLiarsDice,
    blackjackInsurance, blackjackDouble, blackjackSplit,
    liarsDiceRaise, liarsDiceCallLiar, liarsDiceCheat, exitLiarsDiceTable,
    openInsultDuelTable, startInsultDuel,
    showChallengesMenu, startDailyChallenge, startWinterChallenge, startGhostRaceChallenge, startNudistChallenge, startLudditeChallenge, startVegetarianChallenge, startRamseyChallenge, startNoSaveChallenge, promptScoreName, processScoreNameEntry,
    visitBrothel,
    startOperationGame,
    openTelegraphOffice, startTelegraphGame,
    openStealMenu, attemptSteal,
    bullRodeoGameOver,
    openPreparationsMenu, startTrailblazeGame, startTendHerdGame, startScoutGame, startDiplomacyGame, startDoctorsRoundsGame, startTuneWagonGame, startTargetPracticeGame, startStorytellingGame,
};

function updateJourneyProgress() {
    const bar = document.getElementById("main-progressbar");
    if (!bar || !wagon) return; // Safety guard

    let progress = 0;

    if (wagon.route === "Ironman") {
        // Endless rolling odometer loop resets every 1,000 miles
        const currentOdometerSegment = wagon.totalDistance % 1000;
        progress = (currentOdometerSegment / 1000) * 100;
    } 
    else if (wagon.route === "Random") {
        // Since distance varies wildly per leg, measure node completion (up to 25)
        progress = (wagon.pathHistory.length / 25) * 100;
    } 
    else {
        // Standard static routes map directly to RouteDistances mapping dictionary
        const targetDistance = RouteDistances[wagon.route] || 2170;
        progress = (wagon.totalDistance / targetDistance) * 100;
    }

    // Clamp between 0 and 100 so it doesn't overflow visually
    bar.value = Math.max(0, Math.min(progress, 100));
}

function textUpdateUI() {
    if (!wagon) return;
    const party = wagon.characters;
	const grades = { 1: "MILD", 2: "MODERATE", 3: "SEVERE" };
	const isGlitching = (wagon.sanity < 30 && Math.random() < 0.25);
    const continueBtn = document.getElementById("continue-button");
    const continueBtnLabel = document.getElementById("continue-button-label");
    const continueTooltip = document.getElementById("continue-tooltiptext");

    if (wagon.isStuck) {
        if (continueBtnLabel) continueBtnLabel.textContent = "STUCK";
        continueBtn.style.backgroundColor = "#d9534f"; // Red
        if (continueTooltip) continueTooltip.textContent = `Your wagon is missing a ${wagon.brokenPart}. Trade or Gather to fix it!`;
    } else {
        if (continueBtnLabel) continueBtnLabel.textContent = "Continue Journey";
        continueBtn.style.backgroundColor = "#28a745"; // Success Green
        if (continueTooltip) continueTooltip.textContent = "Forward, ever forward, toward the next calamity.";
    }
	

    for (let i = 1; i <= 5; i++) {
        const char = party[i - 1];
        const nameEl = document.getElementById(`player-${getWord(i)}-name`);
        const statusEl = document.getElementById(`player-${getWord(i)}-status`);
        const illnessEl = document.getElementById(`player-${getWord(i)}-illness`);
	    
        if (char && nameEl && statusEl && illnessEl) {
            // Update text content
            nameEl.textContent = char.name;
            statusEl.textContent = char.status;
            illnessEl.textContent = char.illness ? char.illness.length : 0;
	    
            // Handle Permadeath Visuals
            if (char.status === "Dead") {
                nameEl.style.color = "#888"; // Grey out
                nameEl.style.textDecoration = "line-through";
                statusEl.style.color = "red";
                illnessEl.textContent = "—"; // Clear illness count for dead
            } else {
                nameEl.style.color = "inherit";
                nameEl.style.textDecoration = "none";
                statusEl.style.color = "inherit";
            }
	    
            // Handle Gamer/Sanity Glitch
            if (isGlitching && char.status !== "Dead") {
                nameEl.style.fontFamily = "Webdings, symbol";
                // Note: Don't call updateActionPrompt inside a loop or it will spam 5 times!
            } else {
                nameEl.style.fontFamily = "inherit";
            }
	    
            // Update Illness Tooltips
            if (char.status !== "Dead" && char.illness && char.illness.length > 0) {
                const grades = { 1: "MILD", 2: "MODERATE", 3: "SEVERE" };
                const illnessList = char.illness.map(ill => 
                    `${grades[ill.severity] || "MODERATE"} case of ${ill.name}`
                ).join(" and a ");
                
                illnessEl.title = `${char.name} has a ${illnessList}.`;
                illnessEl.style.cursor = "help";
            } else if (char.status === "Dead") {
                illnessEl.title = "Rest in pixels.";
            } else {
                illnessEl.title = "You do not yet have dysentery.";
                illnessEl.style.cursor = "default";
            }
        }
    }

    const nextStopEl = document.getElementById("next-stop-name");
	if (nextStopEl && wagon) {
		if (wagon.nextLandmark && Landmarks[wagon.nextLandmark]) {
			nextStopEl.textContent = Landmarks[wagon.nextLandmark].name;
		} else {
			nextStopEl.textContent = "the destination";
		}
	}

    // Landmark icon tooltip — reads the num straight off whatever's actually
    // rendered right now (see LANDMARK_BY_NUM above for why).
    const landmarkGraphicImg = document.getElementById('landmark-graphic');
    if (landmarkGraphicImg) {
        const srcMatch = landmarkGraphicImg.src.match(/landmarks\/(\d+)\.png/);
        const shownLoc = srcMatch ? LANDMARK_BY_NUM[parseInt(srcMatch[1], 10)] : null;
        if (shownLoc) {
            landmarkGraphicImg.title = shownLoc.description || shownLoc.name || '';
            landmarkGraphicImg.alt = shownLoc.name || 'landmark';
        }
    }

    const faqTooltip = document.getElementById('faq-tooltiptext');
    if (faqTooltip) {
        let survivalPhrase;
        if (wagon.route === "Ironman") {
            // Endless mode: there's no finish line to count down to.
            survivalPhrase = "forever. It's Ironman — there is no end, only more oxen.";
        } else if (wagon.route === "Random") {
            // Distance-to-goal isn't a fixed number on this route.
            survivalPhrase = "however many miles Random feels like throwing at you next. Nobody knows, least of all you.";
        } else {
            const targetDistance = RouteDistances[wagon.route] || 2170;
            const remaining = Math.max(0, targetDistance - wagon.totalDistance);
            survivalPhrase = `another ${remaining.toFixed(0)} miles`;
        }
        faqTooltip.textContent = `You are looking for help? You are beyond help. But try to keep your family alive for ${survivalPhrase}`;
    }

    const foodEl = document.getElementById('wagon-food-remaining');
    const foodTooltip = document.getElementById('food-tooltiptext');
    
    const milesRemaining = 2170 - wagon.totalDistance;
    const estimatedFoodNeeded = (milesRemaining / 12) * 10;
    
    let foodHover = "You have plenty of food for now.";
    foodEl.style.color = "green"; // Default color

    if (wagon.food < 250) {
        foodEl.style.color = "#d9534f"; // Red
        foodHover = "Are you planning on starving your family?";
    } else if (wagon.food < estimatedFoodNeeded) {
        foodEl.style.color = "#f0ad4e"; // Yellow
        foodHover = "You will need more food somehow before the end of your journey.";
    }
    
    if (foodTooltip) foodTooltip.textContent = foodHover;

    const bulletTooltip = document.getElementById('bullets-tooltiptext');
    let bulletHover;
    if (wagon.bullets > 100) bulletHover = "The NRA is proud even though they don't exist yet.";
    else if (wagon.bullets <= 10) bulletHover = "Every shot has to count.";
    else bulletHover = "Bullets for hunting and defense.";
    if (bulletTooltip) bulletTooltip.textContent = bulletHover;

    const moneyTooltip = document.getElementById('money-tooltiptext');
    let moneyHover = "You saved some to spend along the way. Smart.";
    if (wagon.money > 1000) moneyHover = "You should buy some crypto.";
    else if (wagon.money > 500) moneyHover = "Do you not like spending money?";
    else if (wagon.money <= 0) moneyHover = "Who needs money?";
    if (moneyTooltip) moneyTooltip.textContent = moneyHover;

    const oxenTooltipEl = document.getElementById('oxen-tooltiptext');
    const enoughForWeight = wagon.getLoadRatio() <= 1.0;
    const oxenHealthy = wagon.oxenHealth >= 50;
    let oxenTooltip;
    if (enoughForWeight && oxenHealthy) {
        oxenTooltip = "You have enough oxen to pull your lazy family, and they're in good health.";
    } else if (enoughForWeight && !oxenHealthy) {
        oxenTooltip = "You have enough oxen to pull your lazy family. However, they seem overworked and unhealthy.";
    } else if (!enoughForWeight && oxenHealthy) {
        oxenTooltip = "Your oxen are in good health, but there aren't enough of them to comfortably pull this much weight.";
    } else {
        oxenTooltip = "The ox seem tired and overworked carrying your lazy family around, and there aren't enough of them besides.";
    }
    if (oxenTooltipEl) oxenTooltipEl.textContent = oxenTooltip;

	document.querySelector('.current-date').textContent = `${wagon.month} ${wagon.day}, ${wagon.year}`;
    const tempVal = (wagon.currentTemp !== undefined) ? wagon.currentTemp.toFixed(0) : "N/A";
    document.querySelector('.current-temp').textContent = `${tempVal}°F`;
    document.querySelector('.distance-traveled').textContent = wagon.totalDistance.toFixed(1);
	document.querySelector('.miles-to-landmark').textContent = (wagon.milesToNextLandmark || 0).toFixed(1);
	const profEl = document.getElementById("wagon-profession");
    if (profEl && wagon.professionName) {
        profEl.textContent = wagon.professionName;
    }

    document.getElementById('wagon-food-remaining').textContent = wagon.food.toFixed(0);
    document.querySelectorAll('.wagon-money-remaining').forEach(el => el.textContent = wagon.money.toFixed(2));
    document.getElementById('wagon-bullets-remaining').textContent = wagon.bullets.toFixed(0);

    const firewoodTooltip = document.getElementById('firewood-tooltiptext');
    const firewoodEl = document.getElementById('wagon-firewood-remaining');
    if (firewoodEl) {
        firewoodEl.textContent = wagon.firewood;
        let firewoodTitle;
        if (wagon.firewood <= 0) {
            firewoodEl.style.color = "#d9534f";
            firewoodTitle = "No firewood! Dark camps invite thieves, raw bacon, and things that go bump in the night.";
        } else if (wagon.firewood <= 4) {
            firewoodEl.style.color = "#f0ad4e";
            firewoodTitle = "Firewood is running low. Each night burns 1 bundle (+1 resting, +1 when cold).";
        } else {
            firewoodEl.style.color = "green";
            firewoodTitle = "Firewood bundles. Each night burns 1 (+1 resting, +1 when cold). A good fire keeps spirits up.";
        }
        if (firewoodTooltip) firewoodTooltip.textContent = firewoodTitle;
    }

    const waterTooltip = document.getElementById('water-tooltiptext');
    const waterEl = document.getElementById('wagon-water-remaining');
    if (waterEl) {
        const barrelsShown = (wagon.water / WATER_PER_BARREL).toFixed(1);
        waterEl.textContent = `${barrelsShown}/${wagon.waterBarrels} bbl`;
        const living = wagon.characters.filter(c => c.status !== "Dead").length || 1;
        const daysLeft = wagon.water / living; // ignores desert doubling/rations; a rough gauge
        let waterTitle;
        if (wagon.water <= 0) {
            waterEl.style.color = "#d9534f";
            waterTitle = "NO WATER. Everyone loses 15 health per dry day. Find rain, a river, or a miracle.";
        } else if (daysLeft < 3) {
            waterEl.style.color = "#f0ad4e";
            waterTitle = `Roughly ${Math.floor(daysLeft)} day(s) of water left at current party size. Desert days drink double, and Rations affects this too.`;
        } else {
            waterEl.style.color = "green";
            waterTitle = "Stored water (in barrels). Each person drinks a share daily — double in deserts, and Filling/Bare Bones Rations drink more/less. Refills from rain, rivers, and springs.";
        }
        if (waterTooltip) waterTooltip.textContent = waterTitle;
    }

    const oxenEl = document.getElementById('oxen-count');
    oxenEl.textContent = wagon.oxen;
    
    const health = wagon.oxenHealth;
    if (health >= 80) oxenEl.style.color = "#28a745";
    else if (health >= 40) oxenEl.style.color = "#f0ad4e";
    else if (health >= 5) oxenEl.style.color = "#d9534f";
    else oxenEl.style.color = "black";

    const sanityVal = document.getElementById('wagon-sanity-val');
    const sanityMeter = document.getElementById('sanity-meter');
    
    if (sanityVal && sanityMeter) {
        sanityVal.textContent = Math.round(wagon.sanity);
        sanityMeter.value = wagon.sanity;
        
        // Change color based on madness level
        if (wagon.sanity < 30) sanityMeter.style.accentColor = "purple"; 
        else if (wagon.sanity < 60) sanityMeter.style.accentColor = "orange";
        else sanityMeter.style.accentColor = "#28a745";
    }
    if (sanityMeter) {
        if (wagon.sanity < 20) {
            sanityMeter.classList.add('sanity-glitch'); // Trigger CSS animation
            sanityMeter.style.accentColor = "magenta";
        } else {
            sanityMeter.classList.remove('sanity-glitch');
            if (wagon.sanity < 30) sanityMeter.style.accentColor = "purple"; 
            else if (wagon.sanity < 60) sanityMeter.style.accentColor = "orange";
            else sanityMeter.style.accentColor = "#28a745";
        }
        hallucinate(); 
        updateSprites();
    }
}

function getWord(i) {
    return ["zero", "one", "two", "three", "four", "five"][i];
}

function shakeElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('apply-shake');
    setTimeout(() => el.classList.remove('apply-shake'), 700);
}

// --- Initialization & Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetch('./words.json')
        .then(response => response.json())
        .then(data => { badWords = data.words || []; })
        .catch(err => console.error("Failed to load profanity filter:", err));

    const resumeBtn = document.getElementById("resumeBTN");
	if (localStorage.getItem("oregonTrailSave")) {
        resumeBtn.style.display = "inline-block";
        if (DEBUG) console.log("Save file found!");
    }
    resumeBtn.addEventListener('click', () => {
        loadGame(); 
        fadeOutIn("#start", "#gameMainScreen");
        // document.getElementById('openingSong').play();
        textUpdateUI();
    });
    // Start Game
    document.getElementById("startBTN").addEventListener('click', () => {
        // document.getElementById('openingSong').play();
        pendingChallengeMode = null; // plain "Start New Game" is never a challenge run
        pendingDailyChallenge = null;
        applyNudistProfessionLock();
    applyNewGamePlusUnlock();
        fadeOutIn("#start", "#characterInput");
    });

    // Character Setup
    document.getElementById("characterBTN").addEventListener('click', () => {
        AudioManager.playZoneBGM(1);
		const p1 = document.getElementById("char1").value;
        const p2 = document.getElementById("char2").value;
        const p3 = document.getElementById("char3").value;
        const p4 = document.getElementById("char4").value;
        const p5 = document.getElementById("char5").value;
        
        const profEl = document.querySelector("input[name='profession']:checked");
        const prof = profEl ? profEl.value : null;
		if (DEBUG) console.log("Selected Profession Value:", prof);
		
        if (prof === "Gamer") {
            buildSkillSelector(); 
        } else {
            finalizeCharacterSetup(prof, p1, p2, p3, p4, p5);
        }
    });

    const storeInputs = document.querySelectorAll("#store input[type='number']");
    storeInputs.forEach(input => {
        input.addEventListener('input', () => {
            const isGameStart = (!wagon || wagon.totalDistance === 0);
            const multiplier = isGameStart ? 1.0 : (FortMultipliers[wagon.currentLandmark] || 1.0);

            const oxenQty = Math.trunc(Number(document.querySelector("input[name='oxen']").value)) || 0;
            const clothingQty = Math.trunc(Number(document.querySelector("input[name='clothing']").value)) || 0;
            const bulletQty = Math.trunc(Number(document.querySelector("input[name='bullets']").value)) || 0;
            const wheelsQty = Math.trunc(Number(document.querySelector("input[name='wheels']").value)) || 0;
            const axlesQty = Math.trunc(Number(document.querySelector("input[name='axles']").value)) || 0;
            const tonguesQty = Math.trunc(Number(document.querySelector("input[name='tongues']").value)) || 0;
            const medicineQty = Math.trunc(Number(document.querySelector("input[name='medicine']").value)) || 0;
            const foodQty = Math.trunc(Number(document.querySelector("input[name='food']").value)) || 0;
            const booksQty = Math.trunc(Number(document.querySelector("input[name='books']").value)) || 0;
            const junkQty = Math.trunc(Number(document.querySelector("input[name='junk']").value)) || 0;
            const firewoodQty = Math.trunc(Number(document.querySelector("input[name='firewood']")?.value)) || 0;
            const waterQty = Math.trunc(Number(document.querySelector("input[name='water']")?.value)) || 0;
            
            // Scale base prices by the fort multiplier
            const oxenCost = Number((oxenQty * draftAnimalUnitPrice() * multiplier).toFixed(2));
            const clothingCost = Number((clothingQty * clothingUnitPrice() * multiplier).toFixed(2));
            const bulletCost = Number((bulletQty * 0.5 * multiplier).toFixed(2));
            const wheelsCost = Number((wheelsQty * 10 * multiplier).toFixed(2));
            const axlesCost = Number((axlesQty * 10 * multiplier).toFixed(2));
            const tonguesCost = Number((tonguesQty * 10 * multiplier).toFixed(2));
            const medicineCost = Number((medicineQty * 5 * multiplier).toFixed(2));
            const foodCost = Number((foodQty * 0.20 * multiplier).toFixed(2));
            const booksCost = Number((booksQty * 2.00 * multiplier).toFixed(2));
            const junkCost = Number((junkQty * 5.00 * multiplier).toFixed(2));
            const firewoodCost = Number((firewoodQty * firewoodUnitPrice() * multiplier).toFixed(2));
            const waterCost = Number((waterQty * 4.00 * multiplier).toFixed(2));
            let skillModifier = 1.0;
            let discountText = "";
            
            if (hasSkill("Trade")) {
                skillModifier = 0.95; // 5% Discount
                discountText = ` <span style="color: #009600; font-size: 0.8em;">(5% Merchant Discount!)</span>`;
            }
            const baseTotal = (oxenCost + clothingCost + bulletCost + wheelsCost + axlesCost + tonguesCost + medicineCost + foodCost + booksCost + junkCost + firewoodCost + waterCost);
            const grandTotal = Number((baseTotal * skillModifier).toFixed(2));
    
            // Update UI elements
            document.querySelector(".oxen-total").textContent = `$${oxenCost}`;
			document.querySelector(".clothing-total").textContent = `$${clothingCost}`;
            document.querySelector(".bullet-total").textContent = `$${bulletCost}`;
			document.querySelector(".wheels-total").textContent = `$${wheelsCost}`;
			document.querySelector(".axles-total").textContent = `$${axlesCost}`;
			document.querySelector(".tongues-total").textContent = `$${tonguesCost}`;
			document.querySelector(".medicine-total").textContent = `$${medicineCost}`;
			document.querySelector(".food-total").textContent = `$${foodCost}`;
			document.querySelector(".books-total").textContent = `$${booksCost}`;
			document.querySelector(".junk-total").textContent = `$${junkCost}`;
			const firewoodTotalEl = document.querySelector(".firewood-total");
			if (firewoodTotalEl) firewoodTotalEl.textContent = `$${firewoodCost}`;
			const waterTotalEl = document.querySelector(".water-total");
			if (waterTotalEl) waterTotalEl.textContent = `$${waterCost}`;
            document.querySelector(".store-total").textContent = `$${grandTotal}`;
    
            // Visual feedback if over budget
            const totalDisplay = document.querySelector(".store-total");
            if (totalDisplay) {
                totalDisplay.innerHTML = `$${grandTotal}${discountText}`;
                totalDisplay.style.color = (grandTotal > wagon.money) ? "red" : "black";
            }
        });
    });
    document.getElementById("subtotal").addEventListener('click', () => {
        const oxen = Math.trunc(Number(document.querySelector("#oxen-fields input").value)) || 0;
		const clothing = Math.trunc(Number(document.querySelector("#clothing-fields input").value)) || 0;
        const bullets = Math.trunc(Number(document.querySelector("#bullet-fields input").value)) || 0;
		const wheels = Math.trunc(Number(document.querySelector("#wheels-fields input").value)) || 0;
		const axles = Math.trunc(Number(document.querySelector("#axles-fields input").value)) || 0;
		const tongues = Math.trunc(Number(document.querySelector("#tongues-fields input").value)) || 0;
		const medicine = Math.trunc(Number(document.querySelector("#medicine-fields input").value)) || 0;
        const food = Math.trunc(Number(document.querySelector("#food-fields input").value)) || 0;
		const books = Math.trunc(Number(document.querySelector("#books-fields input").value)) || 0;
		const junk = Math.trunc(Number(document.querySelector("#junk-fields input").value)) || 0;
		const firewood = Math.trunc(Number(document.querySelector("#firewood-fields input")?.value)) || 0;
		const water = Math.trunc(Number(document.querySelector("#water-fields input")?.value)) || 0;
		const baseTotal = (oxen * draftAnimalUnitPrice()) + (clothing * clothingUnitPrice()) + (bullets * 0.5) + (wheels * 10) + (axles * 10) + (tongues * 10) + (medicine * 5) + (food * 0.2) + (books * 2) + (junk * 5) + (firewood * firewoodUnitPrice()) + (water * 4);
		const skillModifier = hasSkill("Trade") ? 0.95 : 1.0;
		const total = baseTotal * skillModifier;
        document.querySelector(".store-total").textContent = `$ ${total.toFixed(2)}`;
    });

    document.getElementById("storeBTN").addEventListener('click', () => {
        const isGameStart = (wagon.totalDistance === 0);
		const oxen = Math.trunc(Number(document.querySelector("#oxen-fields input").value)) || 0;
		// Nudist Run: zero, no matter what the field says. Belt-and-suspenders
		// against the disabled input being re-enabled by stray DOM code.
		const clothing = (wagon.challengeMode === 'nudist') ? 0 : (Math.trunc(Number(document.querySelector("#clothing-fields input").value)) || 0);
        const bullets = Math.trunc(Number(document.querySelector("#bullet-fields input").value)) || 0;
		const wheels = Math.trunc(Number(document.querySelector("#wheels-fields input").value)) || 0;
		const axles = Math.trunc(Number(document.querySelector("#axles-fields input").value)) || 0;
		const tongues = Math.trunc(Number(document.querySelector("#tongues-fields input").value)) || 0;
		const medicine = Math.trunc(Number(document.querySelector("#medicine-fields input").value)) || 0;
        const food = Math.trunc(Number(document.querySelector("#food-fields input").value)) || 0;
		const books = Math.trunc(Number(document.querySelector("#books-fields input").value)) || 0;
		const junk = Math.trunc(Number(document.querySelector("#junk-fields input").value)) || 0;
		const firewood = Math.trunc(Number(document.querySelector("#firewood-fields input")?.value)) || 0;
		const water = Math.trunc(Number(document.querySelector("#water-fields input")?.value)) || 0;
		const baseTotal = (oxen * draftAnimalUnitPrice()) + (clothing * clothingUnitPrice()) + (bullets * 0.5) + (wheels * 10) + (axles * 10) + (tongues * 10) + (medicine * 5) + (food * 0.2) + (books * 2.0) + (junk * 5.0) + (firewood * firewoodUnitPrice()) + (water * 4.0);
		const skillModifier = hasSkill("Trade") ? 0.95 : 1.0;
		const total = Number((baseTotal * skillModifier).toFixed(2));
		
        if (oxen > 20) {
            alert("You can't herd more than 20 oxen at oxen. Heck, good luck herding your kids on this boring and deadly journey.");
            return;
        }
        if (clothing > 50) {
            alert("More than 50 sets of clothing? Are you a Kardashian?");
            return;
        }
        if (bullets > 99) {
            alert("More than 99 boxes of bullets? Are you some kind of Prepper?");
            return;
        }
        if (wheels > 3 || axles > 3 || tongues > 3) {
            alert("There is no room on your wagon for more than 3 of any of the spare parts. Heck, even 3 wagon wheels on top of everything else is already video game logic.");
            return;
        }
        if (medicine > 10) {
            alert("If you have more than 10 bottles of our special Morphine syrup, people will think you are a drug dealer.");
            return;
        }
        if (food > 2000) {
            alert("You can't take more than 2000 pounds of food. Are you trying to get diabetes? You're supposed to die of dysentery.");
            return;
        }
        if (firewood > 60) {
            alert("More than 60 bundles of firewood? You're pulling a wagon, not opening an 1848 Home Depot.");
            return;
        }
        if (water > 6) {
            alert("More than 6 water barrels? The oxen have formed a union and their first demand is 'no aquarium wagons.'");
            return;
        }

        if (isGameStart && clothing === 0) {
            const content = modalChild;
            content.innerHTML = `
                <h3>Matt's General Store</h3>
                <p>Matt's General Store doesn't discriminate against weird nudist families and wishes you the best of luck!</p>
                <div class="buttons">
                    <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-success">Continue</button>
                </div>
            `;
            eventLog.insertAdjacentHTML('afterbegin', "Matt's General Store doesn't discriminate against weird nudist families and wishes you the best of luck!<br>");
            updateActionPrompt(translateSanity(`Matt's General Store doesn't discriminate against weird nudist families and wishes you the best of luck!!`));
			toggleModal("#myModal");
        }

        const needsMinimumOxen = (wagon.oxen === 0 && oxen < 2);
		
        if (oxen < 0 || clothing < 0 || bullets < 0 || wheels < 0 || axles < 0 || tongues < 0 || medicine < 0 || food < 0 || books < 0 || junk < 0 || firewood < 0 || water < 0) {
            alert("Matt's General Store does not accept 'Anti-Matter' as a valid quantity. It is 1848 and we don't know what that is. Please use positive numbers. Nice try, hacker.");
            shakeElement("store");
            return;
        }
	    
        if (wagon.money < total) {
            alert("You don't have enough money! Try selling some of your 'Pointless Junk' or your dignity.");
            shakeElement("store");
            return;
        }
		
        if (isGameStart) {
            if (oxen < 2) {
                alert("You need at least 2 oxen to pull the wagon. Unless you plan on pulling it yourself, which would be a very slow and laborious game. It would only be entertaining for me as I laugh at your poor family.");
                shakeElement("store");
                return;
            }
            if (food < 200) {
                alert("200 lbs of food is the bare minimum to leave town. Your family cannot survive on vibes alone.");
                shakeElement("store");
                return;
            }
            if (bullets < 10 && wagon.professionName !== "Fisherman") {
                alert("You should probably take at least 10 bullets. The wilderness is not as friendly as this store.");
                shakeElement("store");
                return;
            }
            if (water < 1) {
                alert("You need at least 1 water barrel. Humans are basically cucumbers with anxiety — mostly water. Dying of thirst on day 7 is not the dysentery speedrun you want.");
                shakeElement("store");
                return;
            }
        }

        wagon.money -= total;
        wagon.oxen += oxen;
		wagon.clothing += clothing;
        wagon.bullets += bullets;
        wagon.wheels += wheels;
		wagon.axles += axles;
		wagon.tongues += tongues;wagon.medicine += medicine;
        wagon.food += food;wagon.books += books;wagon.junk += junk;
        wagon.firewood += firewood;
        wagon.waterBarrels += water;
        wagon.water += water * WATER_PER_BARREL; // store barrels come full
        const anyPurchased = (oxen + clothing + bullets + wheels + axles + tongues + medicine + food + books + junk + firewood + water) > 0;
        if (anyPurchased) wagon.isPacked = false;
        if (isGameStart) {
            fadeOutIn("#store", "#gameMainScreen");
			startPackingGame({ onDone: () => triggerLandmarkUI(wagon.currentLandmark) });
        } else {
            const storeEl = document.getElementById('store');
            storeEl.style.display = 'none';
            
            document.getElementById("back-button").style.display = 'inline-block';
            document.getElementById("leave-store-btn").style.display = 'none';            
            buildFortModal(Landmarks[wagon.currentLandmark]);
        }
    });

    // Main Game Actions
    document.getElementById("continue-button").addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (btn) {
            btn.style.pointerEvents = "none";
            btn.style.backgroundColor = "lightgreen";
        }

        wagon.turn();
		wagon.isStationaryAtStart = false;
        textUpdateUI();

        setTimeout(() => {
            btn.style.pointerEvents = "auto";
            btn.style.backgroundColor = "#28a745";
        }, 500);
    });

    // Hunt Button
    document.getElementById("hunt-button").addEventListener('click', () => {
        wagon.huntingTime();
        textUpdateUI();
    });
    
    document.getElementById("mute-button").addEventListener('click', () => { AudioManager.toggleMute(); });
    document.getElementById("speech-button").addEventListener('click', () => { SpeechManager.toggle(); });
    SpeechManager.updateButton(); // reflect the persisted on/off state on load
	// Rest Button
    document.getElementById("rest-button").addEventListener('click', () => { buildRestModal(); });
    document.getElementById("fish-button").addEventListener('click', () => { startFishing(); });
    document.getElementById("gather-button").addEventListener('click', () => { startGathering(); });
    document.getElementById("preparations-button").addEventListener('click', () => { openPreparationsMenu(); });
    document.getElementById("storytelling-button").addEventListener('click', () => { startStorytellingGame(); });
    document.getElementById("pace-button").addEventListener('click', () => openPaceModal());
    document.getElementById("rations-button").addEventListener('click', () => openRationsModal());
    document.getElementById("map-button").addEventListener('click', () => {
        fadeOutIn("#gameMainScreen", "#map-screen");
        drawMap(); 
    });
	document.getElementById("trade-button").addEventListener('click', () => { startTrade(); });
    document.getElementById("prospecting-button").addEventListener('click', () => {
        if (wagon.food < 15) {
            updateActionPrompt(translateSanity("You're too hungry to pan for gold. This 'Free-to-Play' experience requires a 'Stamina Refresh' (Food)."));
            return;
        }
        startProspecting();
    });
    document.getElementById("nostalgia-button").onclick = function() {
        wagon.isNostalgia = !wagon.isNostalgia;
        isNostalgia = wagon.isNostalgia;
        const gameScreen = document.getElementById('gameMainScreen');
		AchievementManager.unlock('nostalgia', 'Party Like Its 1985');
    
        if (isNostalgia) {
            gameScreen.classList.add('nostalgia-crt');
            gameScreen.classList.add('nostalgia-crt-active');
            
            if (!document.getElementById('vignette-overlay')) {
                const vignette = document.createElement('div');
                vignette.id = 'vignette-overlay';
                vignette.className = 'crt-vignette';
                gameScreen.appendChild(vignette);
            }
            
            AudioManager.playSound('crt');
        } else {
            gameScreen.classList.remove('nostalgia-crt');
            gameScreen.classList.remove('nostalgia-crt-active');
            
            const vignette = document.getElementById('vignette-overlay');
            if (vignette) vignette.remove();
        }
        this.textContent = isNostalgia ? "Nostalgia: ON" : "Nostalgia: OFF";
        
        textUpdateUI(); 
        updateSprites();
        updateZoneBackground(wagon.currentZone);
        AudioManager.refreshBGM();
        
        const landmarkImg = document.getElementById('landmark-graphic');
        if (landmarkImg && wagon) {
            const currentLoc = Landmarks[wagon.currentLandmark];
            let displayLoc = currentLoc;
    
            if (wagon.milesToNextLandmark > 0 && currentLoc.next.length > 0) {
                displayLoc = Landmarks[currentLoc.next[0]];
            }
            
            if (wagon.currentLandmark === "Independence" && wagon.totalDistance < 50) {
                displayLoc = Landmarks["Independence"];
            }
    
            const newPath = getImagePath(`./img/landmarks/${displayLoc.num}.png`);
            landmarkImg.src = newPath + "?t=" + Date.now(); // Cache-buster
        }
    };
	document.getElementById("save-button").addEventListener('click', () => { saveGame(); });
	document.getElementById("close-map-btn").addEventListener('click', () => { fadeOutIn("#map-screen", "#gameMainScreen"); });
	document.getElementById("modal-cancel-btn").addEventListener("click", () => { toggleModal("#myModal"); });
    
    // Sacrifice (Skull) Button
    document.getElementById("sacrifice-button").addEventListener('click', () => {
        sacrifice();
        textUpdateUI();
    });
    
    // Store Back Button
    document.getElementById("back-button").addEventListener('click', () => {
        fadeOutIn("#store", "#characterInput");
    });
    window.speechSynthesis.onvoiceschanged = () => {
    // This pre-loads voices so speakHint can find the 'Male' one immediately
      window.speechSynthesis.getVoices();
	};
});

// Modal Handlers
function openPaceModal() {
    const content = modalChild;
    
    if (!content) return;

    content.innerHTML = `
        <h3>Change Pace</h3>
        <p>Current: <strong>${wagon.pace}</strong></p>
        <label><input type="radio" name="pace-choice" value="Steady" ${wagon.pace === "Steady" ? "checked" : ""}> Steady - 8 hrs/day</label><br>
        <label><input type="radio" name="pace-choice" value="Strenuous" ${wagon.pace === "Strenuous" ? "checked" : ""}> Strenuous - 12 hrs/day</label><br>
        <label><input type="radio" name="pace-choice" value="Grueling" ${wagon.pace === "Grueling" ? "checked" : ""}> Grueling - 16 hrs/day, -2 health</label>
        <div class="buttons">
            <button id="pace-save-btn" class="btn btn-success" title="Grueling pace, grueling consequences. Lock it in.">Save</button>
        </div>
    `;

    document.getElementById("pace-save-btn").onclick = () => {
        setPace();
    };

    toggleModal("#myModal");
}

function setPace() {
    const choice = document.querySelector('input[name="pace-choice"]:checked').value;
    wagon.pace = choice;
    const msg = `Pace set to ${choice}. Ohana means family. Family means nobody gets left behind or forgotten. But if they don't keep the pace they might get left behind.`;
    eventLog.insertAdjacentHTML('afterbegin', `${msg}<br>`);    
    updateActionPrompt(translateSanity(msg));
    toggleModal("#myModal");
}

function openRationsModal() {
    const content = modalChild;
    
    if (!content) return;

    content.innerHTML = `
        <h3>Change Rations</h3>
        <p>Current: <strong>${wagon.rations}</strong></p>
        <div class="prettyColumn" style="text-align: left; min-height: auto; margin-bottom: 15px;">
            <label><input type="radio" name="rations-choice" value="Filling" ${wagon.rations === "Filling" ? "checked" : ""}> Filling (3 lbs/day)</label><br>
            <label><input type="radio" name="rations-choice" value="Meager" ${wagon.rations === "Meager" ? "checked" : ""}> Meager (2 lbs/day)</label><br>
            <label><input type="radio" name="rations-choice" value="Bare Bones" ${wagon.rations === "Bare Bones" ? "checked" : ""}> Bare Bones (1 lb/day, -1 Health)</label>
        </div>
        <div class="buttons">
            <button id="rations-save-btn" class="btn btn-success" title="You are what you eat. Out here, that's mostly beans.">Save</button>
        </div>
    `;

    // Bind the save button behavior dynamically
    document.getElementById("rations-save-btn").onclick = () => {
        const choice = document.querySelector('input[name="rations-choice"]:checked').value;
        wagon.rations = choice;
        eventLog.insertAdjacentHTML('afterbegin', `Rations set to ${choice}. Surely they will last and your family won't starve.<br>`);
        updateActionPrompt(translateSanity(`Rations set to ${choice}. Surely they will last and your family won't starve.`));
        toggleModal("#myModal");
    };

    toggleModal("#myModal");
}

// Helper for transitions
function fadeOutIn(outId, inId) {
    const outEl = document.querySelector(outId);
    const inEl = document.querySelector(inId);
    outEl.style.display = "none";
    inEl.style.display = "block";
}

// Profession Logic


function getSkillBonus(skillName) {
    const prof = wagon.professionName; // Ensure this is set during character creation
    // Hunter gets +Tracking, Gunsmith gets +Sharpshooting
    if (prof === "Hunter" && hasSkill("Tracking")) return 15;
    if (prof === "Gunsmith" && hasSkill("Sharpshooting")) return 15;
    return 0;
}

function renderHuntDashboard(options = null) {
    const content = modalChild;
    if (!content) return;
    const s = wagon.huntState;
    const isGamer = (wagon.professionName === "Gamer");

    content.innerHTML = `
        <div id="hunt-container" class="mini-game-wrapper" style="background: url('./img/hunt/hunt_bg.png'); border: 4px solid #333; image-rendering: pixelated; font-family: 'Londrina Solid';">
            
            <div id="mini-game-msg-area" style="position: absolute; top: 0; left: 0; width: 100%; background: rgba(0,0,0,0.8); color: white; border-bottom: 2px solid #555; padding: 10px; text-align: center; font-size: 2.5cqw; z-index: 110;">
                ${s ? (s.message || "It is Hunting Season!") : "You find tracks in the area."}
            </div>

            ${(s && s.animal) ? `
            <div style="position: absolute; top: 12%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.55); padding: 4px 14px; border-radius: 8px; z-index: 100; text-align: center; border: 2px solid ${s.distance === 'close' ? '#c0392b' : '#2e86de'};">
                <div style="font-size: 0.85cqw; color: #eee;">TARGET: ${s.animal.name} &nbsp;|&nbsp; HP: ${s.hp}</div>
                <div style="font-size: 1.1cqw; font-weight: bold; color: ${s.distance === 'close' ? '#ff6b5b' : '#5dade2'};">
                    🎯 RANGE: ${s.distance.toUpperCase()}${s.distance === 'close' && s.animal.difficulty >= 4 ? ' ⚠️' : ''}
                </div>
                <div style="font-size: 0.7cqw; color: #aaa;">🔫 ${wagon.bullets} bullets &nbsp;|&nbsp; ⏳ ${s.turnsRemaining ?? '?'} turns before it's gone</div>
            </div>` : ""}
            
            <div id="hunt-ui-area" style="position: absolute; bottom: 30px; width: 100%; text-align: center; z-index: 100; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                </div>
        </div>
    `;

    const btnContainer = document.getElementById("hunt-ui-area");
    
    // Add Gamer HUD inside the UI area
    if (isGamer) {
        const gamerHUD = document.createElement('div');
        gamerHUD.style.cssText = "color: cyan; font-size: 1.2em; margin-bottom: 5px; text-shadow: 1px 1px black;";
        gamerHUD.textContent = "SYSTEM: AUTO-AIM_V1.2 ENABLED | PING: 4ms | FPS: 60";
        btnContainer.prepend(gamerHUD);
    }

    // 2. STATE 1: CHOOSE TRACKS
    if (!s) {
        if (wagon.huntDaylight > 0) {
            const displayOptions = options || generateHuntOptions();
            
            const trackButtons = document.createElement('div');
            trackButtons.className = "buttons";
            
            displayOptions.forEach(a => {
                const btn = document.createElement("button");
                if (a === null) {
                    btn.className = "btn btn-secondary";
                    btn.textContent = "Cold Trail";
                    btn.onclick = () => {
                        wagon.huntDaylight = Math.max(0, wagon.huntDaylight - 5);
                        renderHuntDashboard();
                    };
                } else {
                    btn.className = "btn btn-info";
                    // Safety check for EMOJIS
                    const emoji = (typeof ANIMAL_EMOJIS !== 'undefined' && a.name) ? ANIMAL_EMOJIS[a.name] : (a.emoji || "");
                    btn.textContent = `Follow ${emoji} ${a.name}`;
                    btn.onclick = () => startPursuit(a.name);
                }
                trackButtons.appendChild(btn);
            });

            const exitBtn = document.createElement("button");
            exitBtn.className = "btn btn-danger";
            exitBtn.textContent = "Return to Trail";
            exitBtn.onclick = () => endHuntingDay();
            trackButtons.appendChild(exitBtn);
            
            btnContainer.appendChild(trackButtons);
        } else {
            btnContainer.innerHTML = `<button ${actionAttrs('endHuntingDay')} class="btn btn-success">Daylight Ended - Return to Trail</button>`;
        }
    } 
    // 3. STATE 2: ACTIVE PURSUIT
    else {
        const actionButtons = document.createElement('div');
        actionButtons.className = "buttons";

        if (s.waitingForResult) {
            const contBtn = document.createElement("button");
            contBtn.className = "btn btn-success";
            contBtn.textContent = "Continue...";
            contBtn.onclick = () => {
                s.waitingForResult = false;
                if (s.hp <= 0 || s.turnsRemaining <= 0) wagon.huntState = null;
                renderHuntDashboard();
            };
            actionButtons.appendChild(contBtn);
        } else {

            if (s.distance === 'long') {
                const stalkBtn = document.createElement("button");
                stalkBtn.className = "btn btn-info";
                stalkBtn.textContent = "Stalk";
                stalkBtn.onclick = () => doHuntAction('stalk');
                actionButtons.appendChild(stalkBtn);
            } else {
                if (!s.waitingForResult) {
					if (hasSkill("Animal Handling") && s.animal.name === "Bigfoot") {
						const jerkyBtn = document.createElement("button");
						jerkyBtn.className = "btn btn-warning";
						jerkyBtn.textContent = "Offer Jerky";
						jerkyBtn.onclick = () => handleBigfootInteraction("jerky");
						actionButtons.appendChild(jerkyBtn);
						wagon.huntState.offerJerky = true;
					}
					if (hasSkill("Medical") && s.animal.name === "Bigfoot") {
						const medBtn = document.createElement("button");
						medBtn.className = "btn btn-info";
						medBtn.textContent = "Diagnose Bigfoot";
						medBtn.onclick = () => handleBigfootInteraction("medical");
						actionButtons.appendChild(medBtn);
					}
					if (hasSkill("Trade") && s.animal.name === "Bigfoot") {
						const tradeOptions = [
							{ label: "Offer Food", type: "trade_food" },
							{ label: "Offer Junk", type: "trade_junk" },
							{ label: "Offer Book", type: "trade_book" }
						];
						tradeOptions.forEach(opt => {
							const btn = document.createElement("button");
							btn.className = "btn btn-info";
							btn.textContent = opt.label;
							btn.onclick = () => handleBigfootInteraction(opt.type);
							actionButtons.appendChild(btn);
						});
					}
					if (hasSkill("Survival") && s.animal.name === "Bigfoot") {
						const survBtn = document.createElement("button");
						survBtn.className = "btn btn-info";
						survBtn.textContent = "Talk the Land";
						survBtn.onclick = () => handleBigfootInteraction("survival");
						actionButtons.appendChild(survBtn);
					}
					if (hasSkill("Sewing") && s.animal.name === "Bigfoot") {
						const sewBtn = document.createElement("button");
						sewBtn.className = "btn btn-info";
						sewBtn.textContent = "Offer Clothes";
						sewBtn.onclick = () => handleBigfootInteraction("sewing");
						actionButtons.appendChild(sewBtn);
					}
					if (hasSkill("Fishing") && s.animal.name === "Bigfoot") {
						const fishBtn = document.createElement("button");
						fishBtn.className = "btn btn-primary";
						fishBtn.textContent = "Offer Epic Fish";
						fishBtn.onclick = () => handleBigfootInteraction("fishing");
						actionButtons.appendChild(fishBtn);
					}
                    if (hasSkill("Sharpshooting") && s.animal.name === "Bigfoot") {
                        const btn = document.createElement("button");
                        btn.className = "btn btn-secondary";
                        btn.textContent = "Shoot Something?";
                        btn.onclick = () => handleBigfootInteraction("mute");
                        actionButtons.appendChild(btn);
					}
                    if (hasSkill("Repair") && s.animal.name === "Bigfoot") {
                        const btn = document.createElement("button");
                        btn.className = "btn btn-secondary";
                        btn.textContent = "Repair Something?";
                        btn.onclick = () => handleBigfootInteraction("mute");
                        actionButtons.appendChild(btn);
					}
                    if (hasSkill("Tracking") && s.animal.name === "Bigfoot") {
                        const btn = document.createElement("button");
                        btn.className = "btn btn-secondary";
                        btn.textContent = "Track Something?";
                        btn.onclick = () => handleBigfootInteraction("mute");
                        actionButtons.appendChild(btn);
					}
                    if (hasSkill("Prospecting") && s.animal.name === "Bigfoot") {
                        const btn = document.createElement("button");
                        btn.className = "btn btn-secondary";
                        btn.textContent = "Ask about Gold";
                        btn.onclick = () => handleBigfootInteraction("mute");
                        actionButtons.appendChild(btn);
					}
                    if (hasSkill("Gathering") && s.animal.name === "Bigfoot") {
                        const btn = document.createElement("button");
                        btn.className = "btn btn-secondary";
                        btn.textContent = "Offer Weed";
                        btn.onclick = () => handleBigfootInteraction("weed");
                        actionButtons.appendChild(btn);
					}
                }
			}
            if (!s.cooldowns) s.cooldowns = { Rifle: 0, Shotgun: 0, Pistol: 0 }; // defensive, e.g. a save from before this existed
            ["Rifle", "Shotgun", "Pistol"].forEach(w => {
                const weapon = WEAPONS[w];
                const onCooldown = (s.cooldowns[w] || 0) > 0;
                const outOfAmmo = wagon.bullets < weapon.ammoCost;
                const accuracy = Math.min(100, (s.distance === "long" ? weapon.longAccuracy : weapon.closeAccuracy) + (hasSkill("Sharpshooting") ? 15 : 0) + sharpshooterBonus());
                const ammoLabel = `${weapon.ammoCost} bullet${weapon.ammoCost > 1 ? 's' : ''}`;

                const shootBtn = document.createElement("button");
                shootBtn.className = "btn btn-danger";
                if (onCooldown) {
                    shootBtn.textContent = `${w} Reloading...`;
                    shootBtn.disabled = true;
                    shootBtn.title = `Cycling the ${w.toLowerCase()} — ready next turn. This is the whole reason to carry a Pistol: it never needs this.`;
                } else if (outOfAmmo) {
                    shootBtn.textContent = `Shoot ${w} (${ammoLabel}) — no ammo`;
                    shootBtn.disabled = true;
                    shootBtn.title = `Not enough bullets. Needs ${ammoLabel}, you have ${wagon.bullets}.`;
                } else {
                    shootBtn.textContent = `Shoot ${w} — ${ammoLabel}, ${accuracy}% (${s.distance})`;
                    shootBtn.title = weapon.reloadTurns > 0
                        ? `Costs ${ammoLabel} per shot. Needs a turn to reload after firing — you'll be stuck with the Pistol until it's cycled.`
                        : `Costs ${ammoLabel} per shot. No reload — always ready, which is the whole point of a sidearm.`;
                    shootBtn.onclick = () => doHuntAction('shoot', w);
                }
                actionButtons.appendChild(shootBtn);
            });
            
            const fleeBtn = document.createElement("button");
            fleeBtn.className = "btn btn-warning";
            fleeBtn.textContent = "FLEE";
            fleeBtn.title = "Live to hunt another day. Or don't hunt at all today. Your call.";
            fleeBtn.onclick = () => { wagon.huntState = null; renderHuntDashboard(); };
            actionButtons.appendChild(fleeBtn);
        }
        btnContainer.appendChild(actionButtons);
    }

    // FINAL STEP: Ensure the modal is visible
    if (!document.querySelector("#myModal").classList.contains('active')) {
        toggleModal("#myModal");
    }
}

function endHuntingDay() {
    if (typeof AudioManager !== 'undefined') {
        AudioManager.returnToPreviousBGM();
    }
    wagon.days += 1;
    wagon.advanceDay();
    // Safety check: only write log messages if the state object hasn't been nullified yet
    if (wagon.huntState) {
        wagon.huntState.message = "You spent the day hunting and return to the trail.";
    }
    if (document.querySelector("#myModal").classList.contains('active')) {
        toggleModal("#myModal");
    }
    updateActionPrompt(translateSanity("You spent the day hunting and return to the trail."));
	wagon.huntedMeatToday = 0;
	wagon.huntState = null; // Safely clear out the active hunt session state last
    textUpdateUI();
}

function startPursuit(animalName) {
	// --- SPECIAL PARODY ANIMAL INTERCEPTS ---
    if (animalName === "Jimothy the Raccoon" || animalName === "Harambe the Gorilla") {
        // Track for Kraven the Hunter achievement
        if (!AchievementManager.data.stats.huntedAnimals.includes(animalName)) {
            AchievementManager.data.stats.huntedAnimals.push(animalName);
            // Dynamic check against total non-Bigfoot animals in ANIMALS list
            if (AchievementManager.data.stats.huntedAnimals.length >= ANIMALS.length) {
                AchievementManager.unlock('kraven', 'Kraven the Hunter');
            }
            AchievementManager.save();
        }

        const isJimothy = animalName === "Jimothy the Raccoon";
        const soundEffect = isJimothy ? 'rude' : 'monster';
        const gifPath = isJimothy ? './img/rude.gif' : './img/monster.gif';

        AudioManager.playSound(soundEffect);

        const content = modalChild;
        content.innerHTML = `
            <div style="text-align: center; background: #000; color: #fff; padding: 20px; border: 4px solid #ffd700; font-family: 'Courier New';">
                <h2 style="color: #ff4444; font-family: 'Rye', serif;">First of all, how dare you sir!</h2>
                <div style="margin: 15px 0;">
                    <img src="${getImagePath(gifPath)}" alt="${animalName}" style="max-width: 100%; max-height: 250px; border: 2px solid #fff; image-rendering: pixelated;">
                </div>
                <p style="font-size: 1.1em; color: #ffd700;">You cannot hunt ${animalName}. Some lines simply cannot be crossed on the trail.</p>
                <div class="buttons" style="margin-top: 15px;">
                    <button class="btn btn-success" ${actionAttrs('endHuntingDay')}>Return to Trail in Shame</button>
                </div>
            </div>
        `;

        if (!document.querySelector("#myModal").classList.contains('active')) {
            toggleModal("#myModal");
        }
        return;
    }

    if (animalName === "Bigfoot") {
        AudioManager.playSound('bigfoot');
    }
    
    AudioManager.playHuntBGM();
    
    const animal = (animalName === "Bigfoot") ? BIGFOOT : ANIMALS.find(a => a.name === animalName);
    
    if (!animal) {
        console.error("Animal not found:", animalName);
        return;
    }
	
	if (animalName === "Bigfoot") {
        wagon.sanity = Math.max(0, wagon.sanity - 5);
	}

    wagon.huntState = { 
        animal: animal, 
        hp: animal.hp, 
        distance: "long",
        isProcessing: false,
		offerJerky: false,
        turnsRemaining: baseTurnsForAnimal(animal),
        cooldowns: { Rifle: 0, Shotgun: 0, Pistol: 0 },
    };
    
    renderHuntDashboard(); 
}

function doHuntAction(action, weaponName = null) {
    const s = wagon.huntState;
    if (!s || s.isProcessing) return;
	wagon.huntDaylight = Math.max(0, wagon.huntDaylight - 10);
    s.isProcessing = true;
    s.message = "You hold your breath... checking for movement...";
    wagon.huntState.waitingForResult = true;
    renderHuntDashboard(); 

    setTimeout(() => {
        s.isProcessing = false;

        if (action === 'stalk') {
            const stealthChance = getStealthChance(wagon, Zones[wagon.currentZone]);
            if (Math.random() * 100 < stealthChance) {
                s.distance = "close";
                if (s.animal.name === "Bigfoot") {
                    AchievementManager.unlock('bigfoot', 'Less Blurry in Person');
                    s.message = "You sneak up to Bigfoot! He seems calm. What do you do?";
                } else {
                    let sneaks = [
                        "You successfully closed the distance! You have good stalker skills.",
                        "You move very carefully, silent as you can be. For the moment your prey has not spotted you.",
                        "You are very sneaky in your leather outfit because it is made of hide. And you sneak closer to your target.",
                        "You moved like a ninja, silent and deadly. Your prey hasn't spotted you. But now you're wondering if there is a ninja out there that you haven't spotted. Probably.",
                        "Like your farts, today you are silent and deadly. You sneak up to your prey.",
                        "You move up singing Don't Be Suspicious over and over again. For some insane reason that works. Damned video game logic.",
                        "Today the RNG gods favor you and you passes your sneak check.",
						"You did not forget the tactical stealth part of this tactical shooter. You sneak right up to your prey.",
						"Tom Clancy looks down upon you from above as you sneak up to your prey.",
                    ];
                    let sneak = (wagon.professionName === "Gamer") 
                        ? `You mute your microphone and are silent as you sneak up to your prey.`
                        : sneaks[Math.floor(Math.random() * sneaks.length)];
                    s.message = translateSanity(sneak);
                    updateActionPrompt(translateSanity(sneak));
				}
            } else {
                let spooks = [
                    "You spooked the animal! Animals are a good judge of character and they don't like you.",
                    "With a hungry belly and a deadly weapon, you do your best to stealithly sneek up your prey. Your best wasn't good enough and you scared it away.",
                    "You know you need to bring home some meat if your family is going to avoid starvation. And with their livelihood on the line, you step on a branch and scare away the critter.",
                    "You walk carefully with bated breath as a master hunter approaching their prey. And then you rip a massive fart and scare them away. Damned canned bean lunch! And going home without meat, you'll be eating more beans tomorrow.",
					"You rolled your D20 and failed and your stealth roll. The animal scampers away.",
					"You are not very good at the tactical stealth part of a tactical shooter. You scare your prey away.",
					"You loudly scream TOM CLANCY as you try to engage stealth mode, but the animal can hear you scream and runs away.",
                ];
                let spook = (wagon.professionName === "Gamer")
                    ? `There is an exclamation mark over your head. You have been spotted. Snake, be better next time.`
                    : spooks[Math.floor(Math.random() * spooks.length)];
	    		s.message = translateSanity(spook);
				s.waitingForResult = true;
				AudioManager.playSound('alert');
				updateActionPrompt(translateSanity(spook));
                renderHuntDashboard();

                setTimeout(() => {
                    wagon.huntState = null;
                    renderHuntDashboard();
                }, 2500);
                return;
            }
            renderHuntDashboard();
        } else if (action === 'shoot') {
            const weapon = WEAPONS[weaponName];

            if (wagon.bullets < weapon.ammoCost) {
                s.message = translateSanity(`You're out of bullets for the ${weaponName}.`);
                updateActionPrompt(s.message);
                renderHuntDashboard();
                return;
            }
            if ((s.cooldowns && s.cooldowns[weaponName]) > 0) {
                s.message = translateSanity(`The ${weaponName} is still cycling. Not ready yet.`);
                updateActionPrompt(s.message);
                renderHuntDashboard();
                return;
            }

            AudioManager.playSound(weaponName.toLowerCase());
            wagon.bullets -= weapon.ammoCost;

            if (!s.cooldowns) s.cooldowns = { Rifle: 0, Shotgun: 0, Pistol: 0 };
            Object.keys(s.cooldowns).forEach(w => { if (s.cooldowns[w] > 0) s.cooldowns[w]--; });
            s.cooldowns[weaponName] = weapon.reloadTurns;

            let accuracy = (s.distance === "long") ? weapon.longAccuracy : weapon.closeAccuracy;
            if (hasSkill("Sharpshooting")) accuracy += 15;
            accuracy += sharpshooterBonus();
        
            const wasHit = Math.random() * 100 < accuracy;
            if (wasHit) {
                let dmg = calculateDamage(action, weapon, s.animal, wagon.skill, s.distance);
				s.hp = Math.max(0, s.hp - dmg);
                
                let hits = [
                    "Hit! Dealt ${dmg} physical damage and untold emotional damage.",
                    "The shot connected with a dull thud! ${dmg} lbs of force impacted the target.",
                    "Your family may eventually starve on this journey. But not today. The bullet finds its mark for ${dmg} damage.",
                    "You may not know much. But today you know how to shoot a gun. Your shot does ${dmg} damage!",
                    "Nice shooting, Tex! You blast the animal for ${dmg} damage!",
                    "You should be a Marine with that aim. You hit for ${dmg} damage!",
                    "You gift your prey with a new hole. The bullet does ${dmg} damage.",
					"You find the hit box and watch the animal recoil with ragdoll physics. The bullet does ${dmg} damage.",
				]
                let hit = (wagon.professionName === "Gamer")
                    ? "You have an impressive hit for ${dmg} damage. People in the Twitch stream accuse you of using wallhacks."
                    : hits[Math.floor(Math.random() * hits.length)];
                
                let finalHitMsg = hit.replace("${dmg}", dmg);
                finalHitMsg = translateSanity(finalHitMsg);
                s.message = finalHitMsg;
                updateActionPrompt(finalHitMsg);
                
                if (s.hp <= 0) {
					let meat = Math.floor(Math.random() * (s.animal.maxMeat - s.animal.minMeat) + s.animal.minMeat);
                    let amount = Math.min(meat, 250);
                    s.isProcessing = true; // Locks inputs permanently during scene handoff
					s.message = translateSanity(`Success! You brought down the ${ANIMAL_EMOJIS[s.animal.name] || ""} ${s.animal.name} and recovered ${amount} lbs of meat.`);
                    if (DEBUG) console.log("Meat: ", meat);
					if (DEBUG) console.log("Amount: ", amount);
					renderHuntDashboard();
                    
                    setTimeout(() => {
                        finalizeHunt(amount, s.animal);
                    }, 2000);
                    return;
                }
            } else {
                let misses = [
                    "Your breath hitched, and the shot went wild into the brush.",
                    "A twig snapped under your boot, alerting the prey just in time to move and avoid your shot.",
                    "The wind shifted at the worst possible moment; the shot missed.",
                    "Your hungry belly rumbles right as you take the shot. Ironically it causes you to miss shooting your would-be meal.",
                    "Sharpshooting is a skill. Yours is about as sharp as a basketball. You miss the shot.",
                    "With determination you pull the trigger. And with determination the bullet flies to somewhere other than its mark.",
                    "Your shot does not ring true. That's okay. Your family doesn't need to eat tomorrow.",
                ];
		        let miss = (wagon.professionName === "Gamer")
                    ? `Your gamer reflexes were too slow. Input lag strikes again.`
                    : misses[Math.floor(Math.random() * misses.length)];
                updateActionPrompt(translateSanity(miss));
	    		s.message = translateSanity(miss);
				AudioManager.playSound('miss');
            }

			if (s.turnsRemaining <= 0) {
				let escapes = [
					"The animal hit the Escape key.",
					"The animal escapes to live another day. But will your family eat another day?",
					"You were so sure your aim was true and your kids would be proud of their successful hunter parent, but you failed to deliver and the animal escapes.",
					"Unlike your spouse who has been stuck with you for years, the animal escapes.",
					"Your tactical stealth attempt failed. Tom Clancy is disappointed in you.",
				];
				let escape = (wagon.professionName === "Gamer")
                    ? `Your gamer reflexes were too slow and the animal escapes. Are you going to blame input lag or your controller?`
                    : escapes[Math.floor(Math.random() * escapes.length)];
				updateActionPrompt(translateSanity(escape));
				s.message = translateSanity(escape);
				wagon.huntState = null;
				renderHuntDashboard();
				return;
            } else {
                s.turnsRemaining--;
            }

            if (!wasHit && s.animal.difficulty >= 4 && Math.random() < 0.55) {
                s.distance = "close";
                s.isCharging = true;
                s.message += " It didn't like that. It's charging!";
                updateActionPrompt(s.message);
                renderHuntDashboard();
                resolveTrampleAttempt();
                return;
            }

			if (wagon.huntDaylight <= 0) {
				updateActionPrompt(translateSanity("You've run out of daylight. Time to head back to the wagon."));
				s.message = translateSanity("You've run out of daylight. Time to head back to the wagon.");
				renderHuntDashboard();
				
				setTimeout(() => {
                    endHuntingDay();
                }, 2000);
                return;
            }
            
            renderHuntDashboard();
        }
    }, 2500);
}

function finalizeHunt(amount, animalInstance) {
    // Check if we have the animal data passed from the shoot block
    if (!animalInstance) return;

    if (!AchievementManager.data.stats.huntedAnimals.includes(animalInstance.name)) {
        AchievementManager.data.stats.huntedAnimals.push(animalInstance.name);
        // Dynamically checks if player has encountered/hunted all entries in ANIMALS
        if (AchievementManager.data.stats.huntedAnimals.length >= ANIMALS.length) {
            AchievementManager.unlock('kraven', 'Kraven the Hunter');
        }
        AchievementManager.save();
    }

    AchievementManager.data.stats.animalsHuntedThisRun++;
    AchievementManager.save();
    
    AudioManager.playSound('meat');
    wagon.huntedMeatToday = (wagon.huntedMeatToday || 0) + amount;
    
    // Cap the daily harvest
    let gain = amount;
    if (wagon.huntedMeatToday > 250) {
        gain = 250 - (wagon.huntedMeatToday - amount);
        if (gain < 0) gain = 0;
    }
    wagon.food += gain;
    
    if (animalInstance.name === "Bigfoot") {
        updateActionPrompt(translateSanity("You killed Bigfoot and fashioned a legendary fur blanket!"));
		eventLog.insertAdjacentHTML('afterbegin', `You killed Bigfoot and fashioned a legendary fur blanket!<br>`);
		wagon.flags.killedBigfoot = true;
		wagon.flags.bigfoot_blanket = true;
		adjustKarma(-25);
        AchievementManager.unlock('snuggy', 'Snuggy');
		s.message = "You killed Bigfoot and fashioned a legendary fur blanket!";
    }

	let msg = `Success! You brought down the ${ANIMAL_EMOJIS[animalInstance.name] || ""} ${animalInstance.name} and recovered ${gain} lbs of meat.`;
	
	if (DEBUG) console.log("Total Meat for Day: ", wagon.huntedMeatToday);

    if (wagon.huntedMeatToday > 250) {
        msg += " You can only carry 250 lbs back to camp. But don't worry. Overhunting surely won't impact the indigenous population. And you weren't smart enough to bring a pack mule.";
    }

    const canContinue = (wagon.huntedMeatToday < 250 && wagon.huntDaylight > 0);
    const buttonHtml = canContinue 
        ? `<button class="btn btn-primary" ${actionAttrs('prepareNextHunt')}>CONTINUE HUNTING</button>` 
        : `<button class="btn btn-success" ${actionAttrs('endHuntingDay')}>RETURN TO JOURNEY</button>`;

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; background: #000; color: #ffd700; padding: 30px; border: 4px solid #ffd700; font-family: 'Courier New';">
                <h3>🦬 HARVEST COMPLETE 🦬</h3>
                <p style="color: #fff; margin: 20px 0; line-height: 1.4;">${msg}</p>
                ${buttonHtml}
            </div>
        `;
    }
    
    updateActionPrompt(msg);
    eventLog.insertAdjacentHTML('afterbegin', `<span style="color: #008800;">${msg}</span><br>`);
    textUpdateUI();
}

function prepareNextHunt() {
    toggleModal('#myModal');
    
	wagon.huntState = null;

    renderHuntDashboard();
}

function calculateDamage(action, weapon, animal, skill, distance) {
    let baseDamage = weapon.damage * (wagon.diffMultiplier || 1.0);
    let critChance = 0.10; // 10% base crit chance
    
    if (hasSkill("Sharpshooting") && distance === "long") {
        baseDamage *= 1.5; // Sharpshooters hit harder at range
        critChance += 0.20;
    }

    if (Math.random() < critChance) {
        baseDamage *= 2;
		AudioManager.playSound('criticalhit');
        let crits = [
            "CRITICAL HIT! Nat 20 baby!",
            "You rolled a Natural 20! Your projectile ignores the animal's physical armor for ${dmg} true damage.",
            "BOOM! HEADSHOT! You successfully clipped the hitbox for ${dmg} damage. No-scope achieved.",
        ];
        let crit = crits[Math.floor(Math.random() * crits.length)];
		if (wagon.professionName === "Gamer") {
            crit = `Your epic gear set gave you a bonus to a crit chance, and you hit it. That is why you grinded for that gear.`;
		}
        updateActionPrompt(translateSanity(crit));
		wagon.huntState.message = translateSanity(crit);
    }

    return Math.floor(baseDamage);
}

function getStealthChance(wagon, zone) {
    let chance = 50; 

    if (wagon.isSnowing) chance += 20; // Snow muffles footsteps
    if (wagon.hasWater) chance -= 10;  // Rain makes tracking noisy/hard
    if (zone.terrain === "desert") chance -= 15; // Open ground is hard to sneak in
    if (hasSkill("Tracking")) chance += 20;
    if (hasSkill("Animal Handling")) chance += 10;
    // A healthy dog points, flushes, and holds game at bay. An exhausted dog (≤20)
    // is riding in the wagon and helps no one.
    if (wagon.flags && wagon.flags.has_dog && wagon.dogHealth > 20) chance += 10;
        
    return Math.max(10, Math.min(90, chance * (wagon.diffMultiplier || 1.0))); // Clamp between 10-90%
}

function resolveTrampleAttempt() {
    if (wagon.flags.bigfoot_piss) {
        updateActionPrompt("The animal was about to trample you, but it caught a whiff of the Bigfoot Piss and fled in terror!");
        setTimeout(() => {
            toggleModal("#huntModal");
            textUpdateUI();
        }, 3000);
        wagon.huntState = null;
        return;
    }
    const animal = wagon.huntState.animal;
    let dodgeChance = 70 - (animal.difficulty * 10);
    if (hasSkill("Animal Handling")) dodgeChance += 15;
    const karma = wagon.karma || 0;
    if (karma >= 50) dodgeChance += 8;
    if (karma <= -50) dodgeChance -= 8;
    dodgeChance = Math.max(10, Math.min(90, dodgeChance / difficultyIntensityScale()));
	const s = wagon.huntState;
	s.distance = "close";
    
    // Filter to only include living characters
    const livingCharacters = wagon.characters.filter(c => c.health > 0);
    
    if (Math.random() * 100 < dodgeChance) {
        let dodges = [
            "You dodged the charge! You must drive a Dodge Charger!",
            "You successfully rolled for dodge! Your dice haven't failed you yet today. Yet.",
            "You were almost tramped by an animal much, MUCH bigger than you, but somehow got out of the way just in the nick of time.",
            "You barely avoid the charging animal and just BARELY escape a whole world of pain!",
			"You have an evasion ability in your skill tree and activated it to avoid being trampled.",
			"Your prey turned to become the attacker and trample you. But you activated your Tom Clancy tactical stealth mode and disappeared and evaded the attack.",
        ];
        let dodge = dodges[Math.floor(Math.random() * dodges.length)];
        wagon.huntState.message = dodge;
        wagon.huntState.isCharging = false;
    } else if (livingCharacters.length > 0) {
        const victim = livingCharacters[Math.floor(Math.random() * livingCharacters.length)];
        const victimIndex = wagon.characters.indexOf(victim);
        
        const s = wagon.huntState;
        const damage = (s.animal.name === "Bigfoot") ? 100 : 30;
        const cause = `Trampled by ${s.animal.name}`;
    
		victim.health = Math.max(0, victim.health - damage);
    
        let tramps = [
            `You were trampled! ${victim.name} took ${damage} damage.`,
            `You went from hunter to hunted. ${victim.name} took ${damage} damage.`,
            "You were trampled! Maybe it won't be the animals dying out here today!",
            "These are dangerous wildlife, MUCH bigger than you and you were just trampled!",
            "You messed with the bull and you got the horns. Or in this case, you were trampled.",
            "You were violently trampled by the big fella'. Man, it must suck to be you.",
            "You were trampled by the animal you hoped to eat. You're not very good at this hunting thing."
        ];
        
        let tramp = tramps[Math.floor(Math.random() * tramps.length)];
    
        if (wagon.professionName === "Gamer") {
            tramp = `There is a Metal Gear Solid exclamation point above your head. You have been spotted. Like Bastion going tank mode, you just got ran over!`;
            AudioManager.playSound('alert');
        }
    
        if (s.animal.name === "Bigfoot") {
            tramp = `Bigfoot trampled ${victim.name} for 100 damage! What kind of idiot tries to kill Bigfoot? Were you trying to get a special Bigfoot fur blanket?`;
        }
    
        s.message = tramp;
    
        if (victim.health <= 0) {
            wagon.killCharacter(victimIndex, cause);
        } else {
            eventLog.insertAdjacentHTML('afterbegin', 
                `<span style="color:red;">${victim.name} was trampled for ${damage} damage!</span><br>`
            );
        }
    
		wagon.huntState.message = tramp.replace("${victim.name}", victim.name);
        wagon.statusAdjuster();
        textUpdateUI();
        s.waitingForResult = true;
    }
    renderHuntDashboard(); 
}

function startFishing() {
    if (wagon.challengeMode === 'vegetarian') {
        updateActionPrompt("Vegetarian Run: you leave the fish alone. They seem grateful.");
        return;
    }
    const loc = Landmarks[wagon.currentLandmark];
    const zone = wagon.currentZone;
    
    // Determine if water is present based on your rules
    let waterFound = false;

    // Guaranteed water if at a river landmark
    if (loc.type === "river") {
        waterFound = true;
    } 
    // Geographic probabilities
    else if (zone === 1 || zone === 2) {
        waterFound = true; // Assume plains have accessible water
    } 
    else if (zone === 3 || zone === 5) {
        waterFound = Math.random() < 0.50; // 50% chance in mountains
    } 
    else if (zone === 4) {
        // Only 30% in the dry basin unless near the Snake River
        const isNearSnake = (wagon.currentLandmark === "Snake River Crossing");
        waterFound = isNearSnake ? true : (Math.random() < 0.30);
    }

    if (!waterFound) {
        updateActionPrompt(translateSanity("You scout for a fishing spot, but the area is bone dry. Maybe try again later?"));
        return;
    }

    const content = modalChild;
    content.innerHTML = `
    <div id="fishing-container" class="mini-game-wrapper" style="background: url('./img/fish/fish_bg.png'); border: 4px solid #333; image-rendering: pixelated;">
        <div style="background: rgba(0,0,0,0.6); padding: 15px; color: #00A000; font-family: 'Courier New';">
            <h3>FISHING.EXE - INITIALIZING...</h3>
            <div id="fishing-setup"></div>
        </div>
    </div>
`;
    
    chooseRod();
}

function chooseRod() {
    renderFishingStep("Choose your Rod:", ["Fly Rod", "Cane Pole", "Bottom Rod", "Rod Serling"], chooseTime);
}

function chooseTime() {
    renderFishingStep("When to fish?", ["Early Morning", "Noon", "Late Afternoon", "Whenever my wife lets me"], chooseSpot);
}

function chooseSpot() {
    renderFishingStep("Where to fish?", ["Docks", "Boat", "Shoreline", "Local Aquarium"], chooseBait);
}

function chooseBait() {
    renderFishingStep("Select your Pokébait combatant:", ["Worm-mander", "Squirt-le-Lure", "Bait-asaur"], resolveFishingEncounter);
}

function renderFishingStep(question, options, nextStep) {
    const container = document.getElementById("fishing-setup");
    container.innerHTML = `<p>${question}</p>`;
    const btnBox = document.createElement("div");
    btnBox.className = "buttons";

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "btn btn-info";
        btn.textContent = opt;
        btn.onclick = () => {
            if (opt === "Worm-mander" || opt === "Squirt-le-Lure" || opt === "Bait-asaur") {
                wagon.currentBait = opt; // Save the bait for the battle logic later
            }
            nextStep();
        };
        btnBox.appendChild(btn);
    });
    container.appendChild(btnBox);
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function resolveFishingEncounter() {
    const hasFishingSkill = hasSkill("Fishing");
    const zoneKey = `zone${wagon.currentZone}`;
    
    if (!hasFishingSkill && Math.random() < 0.30) {
        const item = JUNK[Math.floor(Math.random() * JUNK.length)];
		wagon.sanity = Math.max(0, wagon.sanity - 1);
        renderFishingResult(null, item);
        return;
    }

    const availableFish = FISH.filter(f => f[zoneKey] === true);
    
    const rarityWeights = { common: 60, uncommon: 25, rare: 10, epic: 5 };
    let pool = [];

    availableFish.forEach(f => {
        const weight = rarityWeights[f.rarity] || 10;
        for (let i = 0; i < weight; i++) pool.push(f);
    });

    const caughtFish = pool[Math.floor(Math.random() * pool.length)];
    renderFishingResult(caughtFish);
}

function renderFishingResult(fish, junkItem = null) {
    const container = document.getElementById("fishing-setup");
	wagon.huntDaylight = Math.max(0, wagon.huntDaylight - 20); // Fishing takes time!

    if (junkItem) {
        container.innerHTML = `
            <p>You reeled in... <strong>${junkItem}</strong>.</p>
            <p>It's useless. Even the oxen are laughing at you.</p>
            <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-danger">Return to Trail</button>
        `;
    } else {
        const known = wagon.flags && wagon.flags.knownFishTypes && wagon.flags.knownFishTypes[fish.name];
        const hint = known
            ? `<p style="color:#2e86de; font-size:0.9em;">You've hooked one of these before — you remember it favors <strong>${known}</strong>.</p>`
            : '';
        container.innerHTML = `
            <p>A wild <strong>${fish.name}</strong> appeared!</p>
            <p>Rarity: ${fish.rarity.toUpperCase()} | Estimated Weight: ${fish.baseWeight} lbs</p>
            ${hint}
            <div class="buttons">
                <button ${actionAttrs('startPokeBattle', [fish.name])} class="btn btn-success">Battle!</button>
                <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-warning">Let it go</button>
            </div>
        `;
    }
}

const BAIT_RELATIONS = {
    "Worm-mander": { strong: "Bait-asaur", weak: "Squirt-le-Lure" },
    "Bait-asaur": { strong: "Squirt-le-Lure", weak: "Worm-mander" },
    "Squirt-le-Lure": { strong: "Worm-mander", weak: "Bait-asaur" }
};

function startPokeBattle(fishName) {
    const fishData = FISH.find(f => f.name === fishName);
    const hpMap = { common: 40, uncommon: 50, rare: 60, epic: 70 };
	let startingHP = hasSkill("Fishing") ? 70 : 50;
	startingHP = startingHP * (wagon.diffMultiplier || 1.0);

    const fishType = fishData.type;
    if (!wagon.flags) wagon.flags = {};
    if (!wagon.flags.knownFishTypes) wagon.flags.knownFishTypes = {};
    wagon.flags.knownFishTypes[fishName] = fishType;

    AudioManager.playFishingBGM();
    if (fishData.rarity === "epic") {
        AudioManager.playSound('shiny');
    }

    wagon.battleState = {
        fish: fishData,
        fishHP: hpMap[fishData.rarity] || 40,
        fishMaxHP: hpMap[fishData.rarity] || 40,
        fishType: fishType,
        currentBait: wagon.currentBait,
        // Track HP for each bait individually so swapping doesn't carry over damage
        party: {
            "Worm-mander": startingHP,
            "Squirt-le-Lure": startingHP,
            "Bait-asaur": startingHP
        },
        playerMaxHP: 60,
        log: `A wild ${fishName} appeared! Go ${wagon.currentBait}!`
    };

    const b = wagon.battleState;
    if (wagon.isGamer) {
        b.log = `System: "Critical Error - Pokémon.exe has hijacked the fishing rod." ${b.log}`;
    }
    renderPokeBattleUI();
}

function renderPokeBattleUI() {
    const b = wagon.battleState;
    const content = modalChild;
    
    const currentPlayerHP = b.party[b.currentBait];
    const playerHPPercent = (currentPlayerHP / b.playerMaxHP) * 100;
    const fishHPPercent = (b.fishHP / b.fishMaxHP) * 100;

    // Determine HP bar colors (Green -> Yellow -> Red)
    const getBarColor = (pct) => {
        if (pct <= 20) return "#e05030"; // Red
        if (pct <= 50) return "#f8d030"; // Yellow
        return "#70c0a0"; // Green
    };
	const displayFishHP = Math.round(b.fishHP);
	const shinyEffect = b.fish.rarity === "epic" ? "animation: flash 0.5s infinite;" : "";
	const baitDesc = BAIT_DESCRIPTIONS[b.currentBait] || "";

    content.innerHTML = `
        <div class="pokemon-battle-container" style="background: #e0f8d0; font-family: 'Courier New', Courier, monospace; border: 4px solid #333; padding: 10px; color: #081820; min-width: 400px;">
            
            <div style="display: flex; justify-content: flex-end; align-items: flex-end; margin-bottom: 20px;">
                <div style="width: 50%; text-align: left; border-bottom: 2px solid #333; margin-right: 10px;">
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 0.9em;">${b.fish.name}</div>
                    <div style="background: #eee; border: 1px solid #333; height: 10px; width: 100%; margin: 4px 0;">
                        <div style="background: ${getBarColor(fishHPPercent)}; height: 100%; width: ${fishHPPercent}%; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 0.8em; text-align: right;">HP: ${displayFishHP}/${b.fishMaxHP}</div>
                </div>
                <img src="./img/fish/${b.fish.rarity}.png" style="width: 120px; height: 120px; image-rendering: pixelated; ${shinyEffect}" alt="${b.fish.rarity} fish">
            </div>

            <div style="display: flex; justify-content: flex-start; align-items: flex-end; margin-bottom: 20px;">
                <img src="./img/bait/${b.currentBait}.png" 
                     title="${baitDesc}" 
                     style="width: 120px; height: 120px; margin-right: 10px; image-rendering: pixelated; cursor: help;" 
                     alt="${b.currentBait}">
                
                <div style="width: 50%; text-align: left; border-bottom: 2px solid #333;">
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 0.9em;">${b.currentBait}</div>
                    <div style="background: #eee; border: 1px solid #333; height: 10px; width: 100%; margin: 4px 0;">
                        <div style="background: ${getBarColor(playerHPPercent)}; height: 100%; width: ${playerHPPercent}%; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 0.8em; text-align: right;">HP: ${Math.round(currentPlayerHP)}/${b.playerMaxHP}</div>
                </div>
            </div>

            <div style="background: #fff; border: 2px solid #333; padding: 10px; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between;">
                <p id="battle-text" style="margin: 0 0 10px 0; font-size: 0.9em; line-height: 1.2;">${b.log}</p>
                <div class="buttons" id="battle-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    ${b.waitingForExit ? `
                        ${Object.keys(POKE_MOVES).filter(bait => b.party[bait] > 0).map(bait =>
                            `<button ${actionAttrs('switchBait', [bait])} class="btn btn-warning" style="font-size: 0.8em; padding: 5px;">${bait.toUpperCase()}</button>`
                        ).join('')}
                        <button ${actionAttrs('endFishingBattle')} class="btn btn-dark" style="font-size: 0.8em; padding: 5px; grid-column: span ${2 - (Object.keys(POKE_MOVES).filter(bait => b.party[bait] > 0).length % 2)};">RUN</button>
                    ` : `
                        <button ${actionAttrs('openFightMenu')} class="btn btn-dark" style="font-size: 0.8em; padding: 5px;">FIGHT</button>
                        <button ${actionAttrs('openBagMenu')} class="btn btn-dark" style="font-size: 0.8em; padding: 5px;">BAG</button>
                        <button ${actionAttrs('openBaitMenu')} class="btn btn-dark" style="font-size: 0.8em; padding: 5px;">POKÉBAIT</button>
                        <button ${actionAttrs('endFishingBattle')} class="btn btn-dark" style="font-size: 0.8em; padding: 5px;">RUN</button>
                    `}
                </div>
            </div>
        </div>
    `;
}

function resolvePokeTurn(actionType, detail = null) {
    const b = wagon.battleState;
    if (b.isProcessing) return;
    if (actionType === "Attack" && b.party[b.currentBait] <= 0) return;
    b.isProcessing = true;

    let logMsg = "";

    if (actionType === "Attack") {
        if (detail === "Power Reel") {
            b.log = "PULLING HARD... THE LINE IS AT CRITICAL TENSION!";
            if (wagon.professionName === "Gamer") {
                b.log = "SYSTEM: PIXEL_STRETCH_DETECTION... PRAYING TO RNG-ESUS!";
            }
            updateActionPrompt(b.log);
            renderPokeBattleUI();
            AudioManager.playSound('alert'); // Using alert for tension
		    
            setTimeout(() => {
                const lineBreakChance = 0.25; 
                if (Math.random() < lineBreakChance) {
                    // FAILURE PATH
                    b.log = "CRITICAL FAILURE! The line snapped under the pressure!";
                    if (wagon.professionName === "Gamer") {
                        b.log = "RNG NERF DETECTED! 'The devs clearly didn't playtest this!' The line snaps.";
                    }
                    
                    updateActionPrompt(b.log);
                    renderPokeBattleUI();
                    AudioManager.playSound('miss');
                    
                    setTimeout(() => { 
                        endFishingBattle(); 
                    }, 3000); 
                } else {
                    // SUCCESS PATH
                    let baseDamage = (10 + (Math.random() * 4 - 2)) * 2.5;
                    const relation = BAIT_RELATIONS[b.currentBait];
                    
                    if (b.fishType === relation.strong) baseDamage *= 1.5;
                    else if (b.fishType === relation.weak) baseDamage *= 0.5;
		    
                    b.fishHP = Math.max(0, b.fishHP - baseDamage);
                    b.log = `SUCCESS! Power Reel dealt ${Math.round(baseDamage)} damage!`;
                    
                    updateActionPrompt(b.log);
                    b.isProcessing = false; // Allow fish to take its turn
                    
                    if (b.fishHP <= 0) finalizeFishingVictory();
                    else renderPokeBattleUI();
                }
            }, 3000);
            return;
        }

        const move = MOVE_DATA[detail] || { dmgMin: 9, dmgMax: 11, effect: null };
        const relation = BAIT_RELATIONS[b.currentBait];

        const rollMoveDamage = () => {
            let dmg = move.dmgMin + Math.random() * (move.dmgMax - move.dmgMin);
            if (b.fishType === relation.strong) dmg *= 1.5;
            else if (b.fishType === relation.weak) dmg *= 0.5;
            if (b.itemUsed === "Anti-Life Orb") dmg *= 1.5;
            return dmg;
        };

        // Razor Leaf: a wild swing that can whiff completely instead of landing its (otherwise above-baseline) damage.
        if (move.effect === "miss_chance" && Math.random() < move.magnitude) {
            logMsg = `${b.currentBait} used ${detail}, but the cast went wide! `;
        } else {
            let baseDamage = rollMoveDamage();

            if (b.fishType === relation.strong) logMsg = `It's super effective! ${b.currentBait} used ${detail}! `;
            else if (b.fishType === relation.weak) logMsg = `It's not very effective... ${b.currentBait} used ${detail}! `;
            else logMsg = `${b.currentBait} used ${detail}! `;

            // Silk Wrap: a chance at an immediate second hit, same turn.
            if (move.effect === "bonus_hit_chance" && Math.random() < move.magnitude) {
                baseDamage += rollMoveDamage();
                logMsg += `It binds tight for a bonus strike! `;
            }

            b.fishHP = Math.max(0, b.fishHP - baseDamage);

            // String Shot / Withdraw: soften the fish's very next hit. Both share one flag since only one move happens per turn.
            if (move.effect === "weaken_next" || move.effect === "mitigate_next") {
                b.incomingDamageMultiplier = 1 - move.magnitude;
            }
            // Sleep Powder: a real chance the fish just doesn't get to act.
            if (move.effect === "skip_chance" && Math.random() < move.magnitude) {
                b.fishSkipsNextTurn = true;
            }
            // Bubble: permanent, stacking reduction to the fish's damage — weak now, pays off over a long fight.
            if (move.effect === "stack_weaken") {
                b.bubbleStacks = Math.min(move.maxStacks, (b.bubbleStacks || 0) + 1);
            }
        }
    } else if (actionType === "Switch") {
        logMsg = `You swapped to ${b.currentBait}! `;
    }

    if (b.fishHP <= 0) {
        finalizeFishingVictory();
        return;
    }

    setTimeout(() => {
        // Sleep Powder landed last turn — the fish skips its action entirely instead of dealing damage.
        if (b.fishSkipsNextTurn) {
            b.fishSkipsNextTurn = false;
            b.log = logMsg + `The wild ${b.fish.name} is worn out and can't move!`;
            b.isProcessing = false;
            renderPokeBattleUI();
            return;
        }

        let fishBaseDamage;
        let usedSignatureMove = false;
        const relation = BAIT_RELATIONS[b.currentBait];

        if (b.fish.rarity === "epic" && Math.random() < EPIC_SIGNATURE_MOVE_CHANCE) {
            usedSignatureMove = true;
            const moveName = EPIC_SIGNATURE_MOVES[b.fish.name] || EPIC_SIGNATURE_MOVE_DEFAULT_NAME;
            fishBaseDamage = EPIC_SIGNATURE_MOVE_DMG_MIN + Math.random() * (EPIC_SIGNATURE_MOVE_DMG_MAX - EPIC_SIGNATURE_MOVE_DMG_MIN);
            b.signatureMoveName = moveName; // stashed for the log line below
        } else {
            fishBaseDamage = 10 + (Math.random() * 4 - 2);
        }

        if (relation.weak === b.fishType) fishBaseDamage *= 1.5;

        if (b.incomingDamageMultiplier) {
            if (!usedSignatureMove) fishBaseDamage *= b.incomingDamageMultiplier;
            b.incomingDamageMultiplier = null;
        }
        if (b.bubbleStacks) {
            fishBaseDamage *= (1 - b.bubbleStacks * 0.10);
        }

        // Apply damage to the SPECIFIC active bait
        b.party[b.currentBait] = Math.max(0, b.party[b.currentBait] - fishBaseDamage);
        
        if (b.itemUsed === "Forgotten Leftovers") {
            b.party[b.currentBait] = Math.min(b.playerMaxHP, b.party[b.currentBait] + 5);
        }

        b.log = usedSignatureMove
            ? logMsg + `The wild ${b.fish.name} unleashes ${b.signatureMoveName}! It dealt ${fishBaseDamage.toFixed(0)} damage!`
            : logMsg + `The wild ${b.fish.name} used Splash! It dealt ${fishBaseDamage.toFixed(0)} damage.`;
        if (usedSignatureMove) AudioManager.playSound('alert');
        
        if (b.party[b.currentBait] <= 0) {
            const anyoneLeft = Object.values(b.party).some(hp => hp > 0);
            if (anyoneLeft) {
                b.log = `${b.currentBait} fainted! Choose another bait to continue.`;
                b.waitingForExit = true; // forces the switch-only UI in renderPokeBattleUI
            } else {
                b.log = `${b.currentBait} fainted! With nothing left in the tackle box, the ${b.fish.name} slips the hook and gets away.`;
                b.isProcessing = true; // lock inputs, mirrors the victory hand-off pattern
                renderPokeBattleUI();
                setTimeout(() => loseFishingBattle(), 2500);
                return;
            }
        }

        b.isProcessing = false;
        renderPokeBattleUI();
    }, 1000);
}

function loseFishingBattle() {
    AudioManager.returnToPreviousBGM();
    wagon.battleState = null;
    const content = modalChild;
    content.innerHTML = `
        <h3>The One That Got Away</h3>
        <p>Every bait in your tackle box is spent. The fish, sensing weakness, makes its escape.</p>
        <button ${actionAttrs('closeModalAndRefreshUI')} class="btn btn-success">Back to Trail</button>
    `;
    updateActionPrompt(translateSanity("The fish got away. All that bait, and nothing to show for it."));
    eventLog.insertAdjacentHTML('afterbegin', `The fish got away after exhausting every bait in the tackle box.<br>`);
    textUpdateUI();
}

function openBaitMenu() {
    const b = wagon.battleState;
    const actions = document.getElementById("battle-actions");
    actions.innerHTML = Object.keys(POKE_MOVES).filter(bait => b.party[bait] > 0).map(bait => 
        `<button ${actionAttrs('switchBait', [bait])} class="btn btn-dark">${bait.toUpperCase()}</button>`
    ).join('') + `<button ${actionAttrs('renderPokeBattleUI')} class="btn btn-secondary">BACK</button>`;
}

function switchBait(newBait) {
    if (wagon.battleState.party[newBait] <= 0) return; // defensive — see openBaitMenu's filter
    wagon.battleState.currentBait = newBait;
    wagon.battleState.log = `Go ${newBait}!`;
    wagon.battleState.waitingForExit = false; // a fresh bait is in — forced-switch state clears
    resolvePokeTurn("Switch");
}

function openBagMenu() {
    const b = wagon.battleState;
    const actions = document.getElementById("battle-actions");

    if (b.hasUsedItem) {
        b.log = "You can't reach into your bag again! Focus on the battle!";
        renderPokeBattleUI();
        return;
    }

    actions.innerHTML = Object.keys(BAG_ITEMS).map(item => 
        `<button ${actionAttrs('useBagItem', [item])} class="btn btn-dark">${item.toUpperCase()}</button>`
    ).join('') + `<button ${actionAttrs('renderPokeBattleUI')} class="btn btn-secondary">BACK</button>`;
}

function useBagItem(itemName) {
    const b = wagon.battleState;
    b.hasUsedItem = true;
    b.itemUsed = itemName;

    let itemMsg = "";

    if (itemName === "Citrus Barry Burton") {
        Object.keys(b.party).forEach(bait => {
            b.party[bait] = Math.min(b.playerMaxHP, b.party[bait] + 25);
        });
        itemMsg = "Your party's HP was restored!";
    } 
    else if (itemName === "Forgotten Leftovers") {
        itemMsg = `${b.currentBait} will now recover HP every turn.`;
    } 
    else if (itemName === "Anti-Life Orb") {
        itemMsg = `${b.currentBait}'s attacks are now overflowing with dark energy!`;
    }
    
    b.log = `You used ${itemName}! ${itemMsg}`;
    
    resolvePokeTurn("Item");
}

function finalizeFishingVictory() {
    const b = wagon.battleState;
    const fishData = FISH.find(f => f.name === b.fish.name);
    if (fishData.rarity === "epic") {
        AudioManager.playSound('shiny');
		wagon.flags.has_epic_fish = true;
		AchievementManager.unlock('shiny', 'Shiny');
		updateActionPrompt("GLIMMERING! You caught an Epic Shiny Fish! This is a legendary prize.");
    }

    const rarityFoodMultiplier = { common: 1.0, uncommon: 1.15, rare: 1.35, epic: 1.6 };
    const rarityMoneyBonus = { common: 0, uncommon: 0, rare: 15 + Math.floor(Math.random() * 11), epic: 40 + Math.floor(Math.random() * 21) };

    let totalMeat = 0;
    for (let i = 0; i < 5; i++) {
        const variance = 0.5 + (Math.random() * 1.5); // 0.5 to 2.0x
        totalMeat += b.fish.baseWeight * variance;
    }
    totalMeat *= rarityFoodMultiplier[fishData.rarity] || 1.0;

    const moneyBonus = rarityMoneyBonus[fishData.rarity] || 0;
    wagon.money += moneyBonus;

    wagon.food += totalMeat;
    wagon.days += 1;
    wagon.advanceDay();

    const moneyLine = moneyBonus > 0
        ? `<p style="color:#2e8b3d;">A catch like that is worth talking about — you sell a couple to a fellow traveler for $${moneyBonus}.</p>`
        : '';

    const content = modalChild;
    content.innerHTML = `
        <h3>Victory!</h3>
        <p>You defeated the ${b.fish.name}!</p>
        <p>You spend the entire day fishing and haul in 5 of them, totaling ${totalMeat.toFixed(1)} lbs of food.</p>
        ${moneyLine}
        <button ${actionAttrs('closeModalAndRefreshUI')} class="btn btn-success">Back to Trail</button>
    `;
    updateActionPrompt(translateSanity(`You caught 5 ${b.fish.name}s! They say fish is brain-food. Your family says you need plenty of it.`));
	eventLog.insertAdjacentHTML('afterbegin', `You caught 5 ${b.fish.name}s!  They say fish is brain-food. Your family says you need plenty of it<br>`);
	AudioManager.returnToPreviousBGM();
}

function openFightMenu() {
    const b = wagon.battleState;
    const moves = POKE_MOVES[b.currentBait];
    const actions = document.getElementById("battle-actions");

    actions.innerHTML = moves.map(move => {
        // Special styling for Power Reel
        const isSpecial = (move === "Power Reel");
        const style = isSpecial ? 'color: #ff0000; font-weight: bold; border: 1px solid #ff0000;' : '';
        const hoverText = isSpecial
            ? 'title="HIGH RISK / HIGH REWARD: Massive damage, but 25% chance to break the line!"'
            : `title="${(MOVE_DESCRIPTIONS[move] || '').replace(/"/g, '&quot;')}"`;

        return `<button ${actionAttrs('resolvePokeTurn', ['Attack', move])} 
                        class="btn btn-dark" 
                        style="font-size: 0.7em; ${style}" 
                        ${hoverText}>
                    ${move.toUpperCase()}
                </button>`;
    }).join('') + `<button ${actionAttrs('renderPokeBattleUI')} class="btn btn-secondary" style="grid-column: span 2;">BACK</button>`;
}

function endFishingBattle() {
    AudioManager.returnToPreviousBGM();
    wagon.battleState = null;
    toggleModal('#myModal');
    textUpdateUI();
}

function detourRiver() {
    for(let i = 0; i < 8; i++) {
        wagon.days += 1;
		wagon.food = Math.max(0, wagon.food - (wagon.characters.length * 5));
        wagon.resourceChecker();
        wagon.statusAdjuster();
    }
    eventLog.insertAdjacentHTML('afterbegin', "You spent seven days going around the river.<br>");
	updateActionPrompt(translateSanity(`You spent seven days going around the river. If your journey is late and runs into bad weather, we know who to blame.`));
    textUpdateUI();
}

function sacrifice() {
    const index = Math.floor(Math.random() * wagon.characters.length);
    const char = wagon.characters[index];
	wagon.killCharacter(index, "Sacrified to the Donners");
	adjustKarma(-30);
    eventLog.insertAdjacentHTML('afterbegin', `${char.name} has been sacrificed to the Donners.<br>`);
    updateActionPrompt(translateSanity(`${char.name} has been sacrificed to the Donners.`));
	wagon.statusAdjuster();
    textUpdateUI();
}

/** * STORE & VALIDATION
 */

function validateNames(profession, p1, p2, p3, p4, p5) {
    if (!profession || !p1 || !p2 || !p3 || !p4 || !p5) {
        shakeElement("charNameInput");
        shakeElement("profession");
        return false;
    }
    fadeOutIn("#characterInput", "#store");
    updateLudditeStoreBanner();
    return true;
}

function drawMap() {
    if (DEBUG) console.log("Drawing map for:", wagon.pathHistory);
    const svgPath = document.getElementById("path-line");
    const marker = document.getElementById("wagon-marker");
    if (!svgPath || !marker || !wagon) return;

    let d = "";

    // Draw history using existing 1000x500 coordinates
    for (let i = 0; i < wagon.pathHistory.length - 1; i++) {
        const start = Landmarks[wagon.pathHistory[i]].pos;
        const end = Landmarks[wagon.pathHistory[i + 1]].pos;
        d += `M ${start.x} ${start.y} L ${end.x} ${end.y} `;
    }

    // Calculate current position on the trail
    const currentLoc = Landmarks[wagon.currentLandmark];
    
    if (currentLoc && currentLoc.next.length > 0) {
        const nextDest = Landmarks[currentLoc.next[0]];
        const totalDist = currentLoc.distanceToNext[0] || 1;
        const progress = 1 - (wagon.milesToNextLandmark / totalDist);
        
        // Internal coordinates stay within the 1000x500 system
        const currentX = currentLoc.pos.x + (nextDest.pos.x - currentLoc.pos.x) * progress;
        const currentY = currentLoc.pos.y + (nextDest.pos.y - currentLoc.pos.y) * progress;
        
        d += `M ${currentLoc.pos.x} ${currentLoc.pos.y} L ${currentX} ${currentY}`;
        
        marker.setAttribute("cx", currentX);
        marker.setAttribute("cy", currentY);
        marker.style.display = "block";
    } else {
        marker.setAttribute("cx", currentLoc.pos.x);
        marker.setAttribute("cy", currentLoc.pos.y);
    }

    svgPath.setAttribute("d", d);
}

// Save the game state to localStorage
function buildSaveData() {
    const saveData = { ...wagon };
    saveData.raftState = { ...wagon.raftState, obstacles: [], isProcessing: false };
    saveData.finaleState = wagon.finaleState
        ? { ...wagon.finaleState, blocks: [], customers: [], projectiles: [], isProcessing: false }
        : null;
    saveData.saloonState = null;
    saveData.dailyRngState = dailyRngState;
    return saveData;
}

function saveGame() {
    if (wagon && wagon.challengeMode === 'nosave') {
        updateActionPrompt("No Save Mode: you committed to this run the moment you started it. No backsies.");
        return;
    }
    localStorage.setItem("oregonTrailSave", JSON.stringify(buildSaveData()));
    
    eventLog.insertAdjacentHTML('afterbegin', "Game saved successfully!<br>");
	updateActionPrompt(`Game saved successfully!`);
}

function persistGamblingState() {
    try {
        localStorage.setItem("oregonTrailSave", JSON.stringify(buildSaveData()));
    } catch (e) {
        if (DEBUG) console.log("Silent gambling save failed:", e);
    }
}

function loadGame() {
    const savedData = localStorage.getItem("oregonTrailSave");
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            
            wagon = Object.assign(new Wagon(), parsed);
            
            // Ensure flag collection isn't missing
            if (!wagon.flags) {
                wagon.flags = {};
            }

            // Resuming a Daily Challenge run: re-arm the seeded Math.random
            // override and restore the exact stream position it was saved at,
            // so the run stays deterministic across reloads.
            if (wagon.dailyChallenge) {
                enableDailyChallengeRNG(
                    (typeof parsed.dailyRngState === "number")
                        ? parsed.dailyRngState
                        : hashDailySeed(wagon.dailyChallenge)
                );
            }
            fetchScoreToken(); // resumed runs need a live score session too
            updateStoreUnitPrices(); // resumed winter runs show doubled labels
            applyVegetarianButtonLock(); // resumed vegetarian runs keep the hunt/fish buttons locked
            applyNoSaveButtonLock(); // resumed No Save runs keep the save button locked

            wagon.characters = parsed.characters.map((c, index) => {
                const newChar = Object.assign(new Character(), c);
                
                if (index === 0) char1 = newChar;
                if (index === 1) char2 = newChar;
                if (index === 2) char3 = newChar;
                if (index === 3) char4 = newChar;
                if (index === 4) char5 = newChar;

                return newChar;
            });

            window.char1 = char1;
            window.char2 = char2;
            window.char3 = char3;
            window.char4 = char4;
            window.char5 = char5;

            updateZoneBackground(wagon.currentZone);
            textUpdateUI();
            
            const landmarkLayer = document.getElementById('layer-landmark');
            const landmarkImg = document.getElementById('landmark-graphic');
            const currentLandmarkData = Landmarks[wagon.currentLandmark];
            
            if (landmarkLayer && landmarkImg && currentLandmarkData) {
                // Look ahead to the upcoming location if traveling between checkpoints
                let displayLandmark = (wagon.milesToNextLandmark > 0 && currentLandmarkData.next.length > 0) 
                    ? Landmarks[currentLandmarkData.next[0]] 
                    : currentLandmarkData;
                    
                landmarkImg.src = getImagePath(`./img/landmarks/${displayLandmark.num}.png`);
            
                // Absolute coordinate calculation matched from your turn engine
                let position = 95; 
                if (wagon.milesToNextLandmark <= 0) {
                    position = 95; 
                } else {
                    const totalLegDist = currentLandmarkData.distanceToNext[0];
                    if (wagon.milesToNextLandmark < totalLegDist * 0.95) {
                        const pctRemaining = wagon.milesToNextLandmark / totalLegDist;
                        position = 95 - (pctRemaining * 100);
                    } else {
                        position = -10;
                    }
                }
                landmarkLayer.style.left = `${position}%`;
                
                const isFar = (wagon.milesToNextLandmark > 60);
                const isStart = (this.totalDistance === 0);
                
                landmarkImg.style.display = (isFar && !isStart) ? 'none' : 'block';
                landmarkLayer.style.display = 'flex';
                
                if (wagon.totalDistance < 5 && wagon.currentLandmark === "Independence") {
                    landmarkLayer.style.left = '95%'; 
                    landmarkImg.src = getImagePath(`./img/landmarks/1.png`);
                }
            }
            
            if (typeof updateMapOverlay === "function") {
                updateMapOverlay();
            }
            if (typeof drawMap === "function") {
                drawMap();
            }
            
            const targetNostalgiaState = !!wagon.isNostalgia;
            isNostalgia = false;
            wagon.isNostalgia = false;
            document.body.classList.remove("nostalgia");
            
            const nostalgiaBtn = document.getElementById("nostalgia-button");
            if (nostalgiaBtn) {
                nostalgiaBtn.textContent = "Nostalgia: OFF";
            }

            if (targetNostalgiaState && nostalgiaBtn) {
                nostalgiaBtn.click();
            } else {
                updateSprites();
            }
            
            // Refresh character condition charts
            wagon.characters.forEach(c => {
                if (typeof c.healthBar === "function") c.healthBar();
            });

            if (wagon.isMuted !== undefined) {
                AudioManager.isMuted = wagon.isMuted;
                if (AudioManager.bgm) AudioManager.bgm.muted = wagon.isMuted;
                const muteBtn = document.getElementById("mute-button");
                if (muteBtn) muteBtn.textContent = wagon.isMuted ? "Unmute" : "Mute";
            }

            if (wagon.currentZone) {
                AudioManager.playZoneBGM(wagon.currentZone);
            }

            const setupScreen = document.querySelector('.setup-screen');
            if (setupScreen) {
                setupScreen.style.display = 'none';
            }

            const mainGameArea = document.querySelector('.layout-grid-main');
            if (mainGameArea) {
                mainGameArea.style.display = 'grid';
            }

            updateActionPrompt("Progress restored from logbook. Welcome back to the trail!");
            eventLog.insertAdjacentHTML('afterbegin', 
                `<span style="color: #008800;">System: Game progress loaded safely.</span><br>`
            );

        } catch (e) {
            console.error("Save state parsing or initialization failed:", e);
            alert("Failed to decode your saved logbook entries smoothly.");
        }
    }
}

function updateActionPrompt(message) {
    // Update the main game screen (hidden behind modal)
    const promptEl = document.getElementById("current-event-msg");
    if (promptEl) {
        promptEl.textContent = message;
    }

    // Find the active mini-game message area
    const miniGameMsg = document.getElementById("mini-game-msg-area");
    if (miniGameMsg) {
        miniGameMsg.textContent = message;
        
        // Add a small "pop" animation so players notice the change
        miniGameMsg.style.animation = 'none';
        miniGameMsg.offsetHeight; // trigger reflow
        miniGameMsg.style.animation = 'messagePop 0.3s ease-out';
    }
}

function getRiverConditions(riverKey) {
    const data = RiverData[riverKey];
    // Weighted random logic to keep conditions near the base
    const roll = Math.random();
    let depth, width;
    
    if (roll < 0.2) {
        depth = data.minDepth;
        width = data.minWidth;
    } else if (roll < 0.8) {
        depth = data.baseDepth;
        width = data.baseWidth;
    } else {
        depth = data.maxDepth;
        width = data.maxWidth;
    }
    
    return { depth: depth, width: width };
}

function resolveCrossing(method, riverKey) {
    const content = modalChild;
    const river = RiverData[riverKey];
	const repair = hasSkill("Repair");
    
    content.innerHTML = `<h3>Crossing ${riverKey}...</h3><p>Attempting to ${method} the river...</p>`;
    
    setTimeout(() => {
        if (method === 'chevy') {
            AudioManager.playSound('chevy');
			handleChevyDisaster();
            return;
        } 
        
        if (method === 'guide') {
            handleSuccess('guide');
            return;
        }

        const depth = Number(content.dataset.currentDepth);
        let bracket = (depth > 30) ? "> 30" : (depth >= 24 ? "24 to 30" : "< 24");
        let skillBonus = 0;
        const baseChance = getBaseProbability(method, bracket, river.diff);
        if (method === 'caulk' && hasSkill("Repair")) {
            skillBonus = 15; // 15% boost to floating the wagon
        }
        const envPenalty = (wagon.isSnowing || wagon.hasWater) ? 10 : 0;
        const finalChance = Math.max(0, baseChance + skillBonus - envPenalty);
        
        if (Math.random() * 100 < finalChance) {
            handleSuccess(method);
        } else {
            handleFailure(method);
        }
    }, 3000);
}

function getBaseProbability(method, bracket, diff) {
    if (method === 'guide') return 99;
	const probabilities = {
        caulk: {
            "> 30": { 1: 99, 2: 97, 3: 95, 4: 85, 5: 75 },
            "24 to 30": { 1: 99, 2: 95, 3: 85, 4: 75, 5: 0 },
            "< 24": { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        },
        ford: {
            "> 30": { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            "24 to 30": { 1: 99, 2: 95, 3: 85, 4: 75, 5: 0 },
            "< 24": { 1: 99, 2: 97, 3: 95, 4: 85, 5: 75 }
        },
        ferry: {
            "any": { 1: 99, 2: 99, 3: 95, 4: 90, 5: 85 }
        }
    };

    // Ferry shortcut
    if (method === 'ferry') return probabilities.ferry.any[diff];
    
    // Safety check for other methods
    if (!probabilities[method] || !probabilities[method][bracket]) {
        console.error(`Missing probability data for: ${method}, ${bracket}`);
        return 0; // Fail safe
    }
    
    return probabilities[method][bracket][diff];
}

function handleSuccess(method) {
    const content = modalChild;
    
    // Define the base paths
    const images = {
        ford: './img/river-ford.png',
        caulk: './img/river-caulk.png',
        ferry: './img/river-ferry.png',
        guide: './img/river-ferry.png'
    };

    // Get the correct path based on Nostalgia mode
    const selectedImg = images[method] || './img/river-ford.png';
    const finalSrc = getImagePath(selectedImg); // Uses the helper function

    // Render the content once
    content.innerHTML = `
        <h3>Success!</h3>
        <img src="${finalSrc}" alt="Success">
        <p>You successfully crossed the river using ${method}.</p>
        <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-success">Continue</button>
    `;
    
    updateActionPrompt(translateSanity(`You successfully crossed the river using ${method}. No one drowned today, but there is always tomorrow.`));
	eventLog.insertAdjacentHTML('afterbegin', `You successfully crossed the river using ${method}. No one drowned today, but there is always tomorrow.<br>`);
}

function handleFailure(method) {
    const victimIndex = Math.floor(Math.random() * wagon.characters.length);
    const char = wagon.characters[Math.floor(Math.random() * wagon.characters.length)];
    const content = modalChild;
    const penaltyRoll = Math.floor(Math.random() * 12); 
    let resultText = "The river crossing was a disaster!";
    let image = getImagePath('./img/river-tipped.png');

    // Randomized failure outcomes
    if (penaltyRoll === 0 && wagon.oxen > 0) {
        wagon.oxen -= 1;
        resultText = "An ox drowned during the struggle! Bessie was such a good girl. Was.";
    } else if (penaltyRoll === 1) {
        // Satirical outcome
        resultText = `${char.name} fell in love with a sexy fishman from The Shape of Water and swam off into the sunset. They are gone forever.`;
		wagon.killCharacter(victimIndex, "Forbidden Love");
    } else if (penaltyRoll === 2) {
        image = getImagePath('./img/river-drown.png');
        resultText = `${char.name} drowned in the river.`;
		wagon.killCharacter(victimIndex, "Drowning");
    } else if (penaltyRoll === 3) {
        char.illness.push({ name: "River Fever", severity: 2 });
        resultText = `${char.name} caught a nasty illness from the freezing water.`;
    } else if (penaltyRoll === 4 && wagon.food > 149) {
        wagon.food = Math.max(0, wagon.food - 150);
        resultText = "The wagon flooded and 150 lbs of food spoiled.";
    } else if (penaltyRoll === 5) {
        if (hasSkill("Repair")) {
            resultText = "A wagon wheel was broken in the river current. Thankfully your Repair skill allowed you to MacGuyver a replacement.";
            if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                AchievementManager.data.stats.partsReplaced.push('wheel');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else if (wagon.wheels > 0) { 
            wagon.wheels--;
        	resultText = "A wagon wheel was broken in the river current. You put on one of your spare wheels.";
            if (!AchievementManager.data.stats.partsReplaced.includes('wheel')) {
                AchievementManager.data.stats.partsReplaced.push('wheel');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else {
            wagon.isStuck = true;
        	wagon.brokenPart = 'wheel';
        	resultText = "A wagon wheel was lost to the river current. Do wagons needs wheels? Yes, they do. Now you are stuck.";
        }
    } else if (penaltyRoll === 6 && wagon.bullets > 19) {
        wagon.bullets = Math.max(0, wagon.bullets - 20);
        resultText = "Your bullet box fell in. You lost 20 bullets.";
    } else if (penaltyRoll === 7) {
        if (hasSkill("Repair")) {
            resultText = "Your wagon axle broke. Does that make it an Axel Folly? Thankfully your Repair skill allowed you to MacGuyver a replacement.";
            if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                AchievementManager.data.stats.partsReplaced.push('axle');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else if (wagon.axles > 0) { 
            wagon.axles--;
        	resultText = "Your wagon axle broke. Does that make it an Axel Folly? You put on one of your spare axles.";
            if (!AchievementManager.data.stats.partsReplaced.includes('axle')) {
                AchievementManager.data.stats.partsReplaced.push('axle');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else {
            wagon.isStuck = true;
        	wagon.brokenPart = 'axle';
        	resultText = "Your wagon axle broke. Does that make it an Axel Folly? Do wagons needs axles? Yes, they do. Now you are stuck.";
        }
    } else if (penaltyRoll === 8 && wagon.tongues > 0) {
        if (hasSkill("Repair")) {
            resultText = "Your wagon tongue broke. Such a tasteless act. Thankfully your Repair skill allowed you to MacGuyver a replacement.";
            if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                AchievementManager.data.stats.partsReplaced.push('tongue');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else if (wagon.tongues > 0) { 
            wagon.tongues--;
        	resultText = "Your wagon tongue broke. Such a tasteless act. You put on one of your spare tongues.";
            if (!AchievementManager.data.stats.partsReplaced.includes('tongue')) {
                AchievementManager.data.stats.partsReplaced.push('tongue');
                if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                    AchievementManager.unlock('theseus', 'Ship of Theseus');
                }
            }
			AchievementManager.save();
        } else {
            wagon.isStuck = true;
        	wagon.brokenPart = 'tongue';
        	resultText = "Your wagon tongue broke. Such a tasteless act. Do wagons needs tongues? Yes, they do. Now you are stuck.";
        }
    } else if (penaltyRoll === 10 && wagon.firewood > 0) {
        const soaked = Math.min(wagon.firewood, Math.floor(Math.random() * 8) + 5);
        wagon.firewood = Math.max(0, wagon.firewood - soaked);
        resultText = `The river soaked your firewood stack. ${soaked} bundles are now expensive, useless sponges.`;
    } else if (penaltyRoll === 11 && wagon.waterBarrels > 0) {
        wagon.waterBarrels -= 1;
        wagon.water = Math.min(wagon.water, wagon.waterBarrels * WATER_PER_BARREL);
        resultText = `A water barrel snapped its lashing and sailed off downstream. Losing drinking water IN a river is a special kind of irony.`;
    } else {
        resultText = "The wagon capsized and equipment was scattered downstream! It took some time, but you were able to gather everything back except your dignity.";
    }
	
    if (wagon.professionName === "Gamer") {
        resultText = resultText + " As a Gamer I wonder if are going to save scum.";
    }

    wagon.statusAdjuster();
    
    content.innerHTML = `
        <h3>Disaster!</h3>
        <img src="${image}" alt="Failed">
        <p>${resultText}</p>
        <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-danger">Continue</button>
    `;
    wagon.sanity = Math.max(0, wagon.sanity - 5);
	updateActionPrompt(translateSanity(resultText));
	eventLog.insertAdjacentHTML('afterbegin', `${resultText}<br>`);
}

function handleChevyDisaster() {
    const content = modalChild;
    const victimIndex = Math.floor(Math.random() * wagon.characters.length);
	const char = wagon.characters[victimIndex];
	wagon.killCharacter(victimIndex, "Drowning (Failed Chevy)");
    wagon.statusAdjuster();

    if (isNostalgia === false) {
	    content.innerHTML = `
            <h3>Chevy Trailblazer</h3>
            <img src="./img/river-chevy.png" alt="Chevy">
            <p>You have a Chevy Trailblazer. You're ready to blaze some trails.<br><br>
            Drove my Chevy to the levee, but the levee was dry (except it wasn't)<br>
            And them good ol' boys were drinkin' whiskey and rye (you shouldn't drink and drive)<br>
            Singin', "This'll be the day that I die.<br><br>
            And ${char.name} did. So sad. Don't drive your Chevy into a river.</p>
            <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-danger">Continue</button>
        `;
	} else {
	    content.innerHTML = `
            <h3>Chevy Trailblazer</h3>
            <img src="./img/classic/river-chevy.png" alt="Chevy">
            <p>You have a Chevy Trailblazer. You're ready to blaze some trails.<br><br>
            Drove my Chevy to the levee, but the levee was dry (except it wasn't)<br>
            And them good ol' boys were drinkin' whiskey and rye (you shouldn't drink and drive)<br>
            Singin', "This'll be the day that I die.<br><br>
            And ${char.name} did die. So sad. Don't drive your Chevy into a river.</p>
            <button ${actionAttrs('toggleModal', ['#myModal'])} class="btn btn-danger">Continue</button>
        `;	
	}
}

let restSequenceActive = false;

function startCampfireRest(onDone) {
    restSequenceActive = true;
    const content = modalChild;

    content.innerHTML = `
        <div style="text-align:center;">
            <h3>Night Falls</h3>
            <div id="campfire-anim" style="
                width: 320px; height: 426px; margin: 0 auto;
                background-image: url('./img/campfire.jpg?v=3');
                background-size: 400% 200%;
                background-position: 0% 0%;
                border-radius: 10px;
            "></div>
            <p id="campfire-caption" style="font-style:italic; color:#888;">${translateSanity("The party settles in around the fire...")}</p>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) {
        // Bypass the lock we just set — this is the sequence itself opening.
        document.querySelector("#myModal").classList.add('active');
    }

    const overlay = document.getElementById('night-overlay');
    if (overlay) overlay.style.opacity = '0.82'; // 4s CSS fade into night

    const fireEl = document.getElementById('campfire-anim');
    const setFrame = (f) => {
        if (!fireEl) return;
        const col = f % 4;
        const row = Math.floor(f / 4);
        fireEl.style.backgroundPosition = `${(col * 100) / 3}% ${row * 100}%`;
    };

    let frame = 0;
    setFrame(0);
    const iv = setInterval(() => {
        frame++;
        if (frame === 4) {
            // Halfway: the fire starts dying and dawn starts creeping back.
            if (overlay) overlay.style.opacity = '0';
            const cap = document.getElementById('campfire-caption');
            if (cap) cap.textContent = "The fire burns low as dawn approaches...";
        }
        if (frame > 7) {
            clearInterval(iv);
            restSequenceActive = false;
            onDone();
            return;
        }
        setFrame(frame);
    }, 1000);
}

function startFirelessRest(onDone) {
    restSequenceActive = true;
    const content = modalChild;

    content.innerHTML = `
        <div style="text-align:center; background:#000; padding: 60px 20px; border-radius:10px;">
            <h3 style="color:#ccc;">A Fireless Night</h3>
            <p style="color:#999; font-style:italic; min-height: 3em;" id="fireless-caption">${translateSanity("The party huddles together in the cold, wishing they had a campfire.")}</p>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) {
        document.querySelector("#myModal").classList.add('active');
    }

    const overlay = document.getElementById('night-overlay');
    if (overlay) overlay.style.opacity = '0.82';

    let windAudio = null;
    if (!AudioManager.isMuted) {
        windAudio = new Audio(sounds.wind);
        windAudio.loop = true;
        windAudio.volume = 0.6;
        windAudio.play().catch(() => {}); // suppress autoplay-block noise
    }

    setTimeout(() => {
        const overlay2 = document.getElementById('night-overlay');
        if (overlay2) overlay2.style.opacity = '0';
    }, 4000);

    setTimeout(() => {
        if (windAudio) {
            windAudio.pause();
            windAudio.currentTime = 0;
        }
        restSequenceActive = false;
        onDone();
    }, 8000);
}

function buildRestModal() {
    const content = modalChild;
    const sickest = wagon.characters.reduce((prev, curr) => (prev.health < curr.health) ? prev : curr);
    
    let medicineBtn = wagon.medicine > 0 
        ? `<button ${actionAttrs('applyRestMethod', ['medicine', sickest.id])} class="btn btn-info">Use Medicine (${wagon.medicine})</button>` 
        : "";

    // Surgery is only on the table (heh) if the patient actually has an
    // illness to cut out, and someone in the wagon is qualified — by medical
    // training, or by a lifetime of Operation-style minigames.
    const canOperate = sickest.status !== "Dead" && sickest.illness.length > 0 && (hasSkill("Medical") || wagon.professionName === "Gamer");
    const operateBtn = canOperate
        ? `<button ${actionAttrs('startOperationGame', [sickest.id])} class="btn btn-danger">🩺 Operate${hasSkill("Medical") ? '' : ' (Gamer Reflexes)'}</button>`
        : "";

    content.innerHTML = `
        <h3>Rest and Recovery</h3>
        <p>The party is resting. How will you treat ${sickest.name} (Health: ${sickest.health})?</p>
        <div class="buttons">
            ${medicineBtn}
            ${operateBtn}
            <button ${actionAttrs('applyRestMethod', ['leeches', sickest.id])} class="btn btn-info">Use Leeches</button>
            <button ${actionAttrs('applyRestMethod', ['dirt', sickest.id])} class="btn btn-info">Rub Dirt On It</button>
            <button ${actionAttrs('applyRestMethod', ['salt', sickest.id])} class="btn btn-danger">Rub Salt In It</button>
            <button ${actionAttrs('applyRestMethod', ['sleep', sickest.id])} class="btn btn-success">Sleep It Off</button>
            <button ${actionAttrs('applyRestMethod', ['walk', sickest.id])} class="btn btn-warning">Walk It Off</button>
        </div>
    `;
    toggleModal("#myModal");
}

function startOperationGame(charId) {
    wagon.rest();
    const charIndex = wagon.characters.findIndex(c => c.id == charId);
    const char = wagon.characters[charIndex];
    if (!char || char.illness.length === 0) {
        // Nothing left to cut out (the rest day itself may have healed it)
        resolveRestNight(`${char ? char.name : "The patient"} seems fine after all. You put the knife away, slightly disappointed.`);
        return;
    }

    const isMedic = hasSkill("Medical");
    const illnessName = char.illness[0].name;

    // Zone geometry (percent of bar). Medical training = wider margins.
    const goodHalf = isMedic ? 13 : 7;      // green zone half-width
    const perfectHalf = isMedic ? 4 : 2.5;  // dead-center zone half-width
    const targetC = 30 + Math.random() * 40; // target center lands at 30-70%

    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center;">
            <h3>🩺 Operating on ${char.name}</h3>
            <p>Removing: <strong>${illnessName}</strong>. Steady... stop the blade in the green.</p>
            <div id="op-bar" style="
                position:relative; height: 44px; margin: 18px 8px; border-radius: 8px;
                background: #f2c9a0; border: 2px solid #8b5a2b; overflow:hidden;">
                <div style="position:absolute; top:0; bottom:0;
                    left:${targetC - goodHalf}%; width:${goodHalf * 2}%;
                    background: rgba(40, 167, 69, 0.55);"></div>
                <div style="position:absolute; top:0; bottom:0;
                    left:${targetC - perfectHalf}%; width:${perfectHalf * 2}%;
                    background: rgba(255, 215, 0, 0.75);"></div>
                <div id="op-marker" style="position:absolute; top:0; bottom:0; left:0%;
                    width: 4px; background: #b30000; box-shadow: 0 0 4px rgba(179,0,0,0.8);"></div>
            </div>
            <div class="buttons">
                <button id="op-cut-btn" class="btn btn-danger" style="font-size:1.2em; padding: 10px 30px;" title="Steady hands. Or don't. The buzzer forgives no one.">CUT!</button>
            </div>
            <p style="font-size:0.85em; color:#888;">${isMedic ? "Your medical training steadies your hand (wider target)." : "No training, just gamer reflexes. Good luck."}</p>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");

    const marker = document.getElementById('op-marker');
    let pos = 0, dir = 1;
    // Same difficulty scale as the packing minigame's timer: Hard is less
    // forgiving (faster sweep, less time to react), Easy is more forgiving.
    const speedByDifficulty = { "Easy": 1.1, "Normal": 1.6, "Hard": 2.3, "New Game+": 2.9 };
    const speed = speedByDifficulty[wagon.difficulty] || 1.6; // percent per 16ms tick
    const iv = setInterval(() => {
        pos += speed * dir;
        if (pos >= 100) { pos = 100; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
        if (marker) marker.style.left = pos + "%";
    }, 16);

    const cutBtn = document.getElementById('op-cut-btn');
    if (cutBtn) cutBtn.onclick = () => {
        clearInterval(iv);
        cutBtn.disabled = true;
        const dist = Math.abs(pos - targetC);
        let msg = "";

        if (dist <= perfectHalf) {
            // Perfect incision — the illness comes out clean
            char.illness.shift();
            char.health = Math.min(100, char.health + 25);
            AudioManager.playSound('criticalhit');
            msg = `A perfect incision! You removed ${char.name}'s ${illnessName} completely. The patient recovers remarkably. Health +25.`;
        } else if (dist <= goodHalf) {
            // Clean enough — illness treated, modest recovery
            const ill = char.illness[0];
            if (ill.severity < 2) {
                char.illness.shift();
                msg = `A steady hand. You cut out ${char.name}'s ${illnessName}. Health +10.`;
            } else {
                ill.severity -= 1;
                msg = `Good work — ${char.name}'s ${illnessName} isn't cured, but it's far less severe now. Health +10.`;
            }
            char.health = Math.min(100, char.health + 10);
            AudioManager.playSound('gold');
        } else {
            // BZZZT. You touched the sides.
            char.health = Math.max(0, char.health - 15);
            AudioManager.playSound('alert');
            msg = `BZZZT! Your hand slipped and you hit something that was NOT the ${illnessName}. ${char.name} howls. Health -15.`;
            if (char.health < 1) {
                wagon.killCharacter(charIndex, "Botched Surgery");
                msg = `BZZZT! Your hand slipped — badly. ${char.name} did not survive the operation.`;
            }
        }

        wagon.statusAdjuster();
        textUpdateUI();
        setTimeout(() => resolveRestNight(msg), 700); // let the buzzer/chime land first
    };
}

function getRandomIllnessName() {
    const randomIllness = ILLNESSES[Math.floor(Math.random() * ILLNESSES.length)];
    return randomIllness.name;
}

function showSplashScreen(safeKey) {
    // Use the already-escaped key for the lookup, then use it for the button
    const loc = Landmarks[safeKey.replace(/\\'/g, "'")]; 
    const content = modalChild;
    const isStart = (wagon && wagon.totalDistance === 0);
    // Independence is type "start", not "fort", but it's a full town with all
    // the same amenities — treat both as fort-ish for the splash buttons.
    const isFort = loc.type === "fort" || loc.type === "start";
    const saloonBanned = isFort && isSaloonBanned();

    let buttonsHTML = isStart
        ? `<button ${actionAttrs('fortTalk')} class="btn btn-info">Talk to People</button>
           <button ${actionAttrs('closeStoreModal')} class="btn btn-info">Shop Again</button>
           ${isFort ? `<button ${actionAttrs('openBuybackMenu')} class="btn btn-warning">Sell Junk ($)</button>
           <button ${actionAttrs('openSaloon', [], { noTitle: true })} class="btn btn-warning" ${saloonBanned ? 'disabled title="You are not welcome back here."' : (gamblingBlocked() ? 'disabled title="Dave Ramsey Mode: gambling is not in the budget."' : 'title="Whiskey, cards, and questionable decisions await."')}>🥃 Visit the Saloon</button>
           <button ${actionAttrs('visitBrothel')} class="btn btn-warning">💋 Visit the Brothel</button>
           <button ${actionAttrs('openTelegraphOffice', [], { noTitle: true })} class="btn btn-info" ${isTelegraphSent() ? 'disabled title="Already sent from this fort."' : 'title="Reach out and touch someone. By Morse code. Slowly."'}>📨 Telegraph Home for Money</button>` : ''}
           <button ${actionAttrs('proceedFromLandmark', [safeKey])} class="btn btn-success">Continue Forward</button>`
        : `<button ${actionAttrs('proceedFromLandmark', [safeKey])} class="btn btn-success">Continue</button>`;

    if (isNostalgia === false) {
        content.innerHTML = `
            <h3>${loc.name}</h3>
            <img src="./img/landmarks/${loc.num}-screen.png" class="splash-img" alt="${loc.name}" style="width:100%; height:auto;">
            <p>${loc.description || ""}</p>
            <div class="buttons">${buttonsHTML}</div>
        `;
	} else {
    content.innerHTML = `
            <h3>${loc.name}</h3>
            <img src="./img/classic/landmarks/${loc.num}-screen.png" class="splash-img" alt="${loc.name}" style="width:100%; height:auto;">
            <p>${loc.description || ""}</p>
            <div class="buttons">${buttonsHTML}</div>
        `;
	}
    
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function getImagePath(path) {
    const activeNostalgia = (typeof wagon !== 'undefined' && wagon.isNostalgia) || isNostalgia;
    if (!activeNostalgia) return path;   
    return path.replace('./img/', './img/classic/');
}

function updateSprites() {
    const oxenSprite = document.getElementById("oxen-sprite");
    const wagonBody = document.getElementById("wagon-body");
    const mapImage = document.getElementById("map-image");

    const isReverseRoute = !!(wagon && wagon.route === "UNO Reverse");
    const isRainbowRoute = !!(wagon && (wagon.route === "Random" || wagon.route === "Ironman"));

    if (oxenSprite) {
        const animalCfg = getDraftAnimalConfig(wagon && wagon.draftAnimal);
        oxenSprite.src = getImagePath('./img/' + animalCfg.spriteFile);
        oxenSprite.title = animalCfg.hoverText;
        oxenSprite.alt = animalCfg.hoverText;
        oxenSprite.style.transform = isReverseRoute ? "scaleY(-1)" : "";
        oxenSprite.classList.toggle("rainbow-cycle", isRainbowRoute);
    }
    if (wagonBody) {
        wagonBody.src = getImagePath('./img/wagon_side.gif');
        const overloaded = wagon && typeof wagon.getLoadRatio === "function" && wagon.getLoadRatio() > 1.0;
        wagonBody.title = overloaded
            ? "Your wagon, dangerously overloaded and creaking with every mile."
            : "Your wagon. Held together by hope, grease, and the occasional prayer.";
        wagonBody.style.transform = isReverseRoute ? "scaleY(-1)" : "";
        wagonBody.classList.toggle("rainbow-cycle", isRainbowRoute);
    }
    if (mapImage) mapImage.src = getImagePath('./img/map.png');

    const faqIcon = document.getElementById('faq-img');
    if (faqIcon) faqIcon.src = getImagePath('./img/faq.png');

    const skullIcon = document.getElementById('sacrifice');
    if (wagon.sanity < 25) {
        skullIcon.src = getImagePath('./img/skull2.png');
    } else {
        skullIcon.src = getImagePath('./img/skull.png');
    }

    const supplyIcons = document.querySelectorAll('.supply-item img');
    supplyIcons.forEach(img => {
        // Get the base path regardless of current state
        let currentSrc = img.getAttribute('src');
        // Strip out the classic folder if it exists to get the clean base path
        let baseSrc = currentSrc.replace('./img/classic/', './img/');
        // Apply getImagePath to the clean base
        img.src = getImagePath(baseSrc);
    });
}

function handleBigfootInteraction(type) {
    const s = wagon.huntState;
    if (!wagon.flags) wagon.flags = {};
    if (!s) return;
    
    s.waitingForResult = true;
    let endEncounter = true; 

    // Helper to trigger Bigfoot's anger for lying about items
    const triggerBigfootRage = (itemLabel) => {
        s.message = `You reach for ${itemLabel} that isn't there! Bigfoot is offended by your empty promises. He charges!`;
        s.dist = 0;
        s.isCharging = true;
        s.offerJerky = false;
        endEncounter = false; 
        adjustKarma(-6);
        resolveTrampleAttempt();
    };

    switch(type) {
        case "jerky":
            if (wagon.food >= 10) {
                if (hasSkill("Animal Handling")) {
                    wagon.food -= 5;
					wagon.flags.bigfoot_talisman = true;
					adjustKarma(12);
					AchievementManager.unlock('nft', 'NFT');
                    s.message = "Bigfoot accepts, handing you something that isn't a mushroom, a Non-Fungible Talisman (NFT), glowing with blockchain energy!";
                } else {
                    s.message = "Bigfoot sniffs the jerky, shakes his head politely, and vanishes into the trees.";
                }
            } else {
                triggerBigfootRage("jerky");
            }
            break;

        case "medical":
            if (wagon.medicine > 0) {
                wagon.medicine--;
				wagon.flags.bigfoot_talisman = true;
				adjustKarma(12);
				AchievementManager.unlock('nft', 'NFT');
                s.message = "You diagnose Bigfoot with 'Pixelated Dysentery.' Your medicine bottle heals him instantly. He gifts you a Talisman!";
            } else {
                s.message = "You diagnose him with dysentery, but have no medicine! He looks insulted by your lack of professional prep.";
            }
            break;

        case "trade_food":
            if (wagon.food > 0) {
                s.message = "Bigfoot looks at your food offer and scoffs. 'I eat berries and jerky, human. I don't want your trail rations.'";
            } else {
                triggerBigfootRage("food");
            }
            break;

        case "trade_junk":
            if (wagon.money > 0 || wagon.wheels > 0 || wagon.axles > 0 || wagon.tongues > 0) {
                s.message = "Bigfoot pushes your junk away. He finds your physical goods to be 'low resolution' and beneath his notice.";
            } else {
                triggerBigfootRage("junk");
            }
            break;

        case "trade_book":
            if (wagon.books > 0) {
                wagon.books--;
                wagon.flags.bigfoot_piss = true;
                s.message = "Bigfoot trades a jar of 'Bigfoot Piss' for your book. He apparently loves the classics. You feel safer already.";
            } else {
                triggerBigfootRage("a book");
            }
            break;

        case "survival":
            wagon.food += 50;
            s.message = "Bigfoot points out a cluster of 'Ultra-Berries.' You gather 50 lbs of food! He nods and retreats into the wild.";
            break;

        case "sewing":
            s.message = "Bigfoot rants about the 'Pantsocracy' and the oppression of zippers. He finds your clothes offensive and flees.";
            break;

        case "fishing":
            if (wagon.flags.has_epic_fish) {
                wagon.flags.has_epic_fish = false;
				wagon.flags.bigfoot_talisman = true;
				AchievementManager.unlock('nft', 'NFT');
                s.message = "Bigfoot's eyes widen at the shiny scales. He swaps his Talisman for your Epic Fish. Pokédex +1!";
            } else {
                s.message = "Bigfoot has a very full Pokédex; he only wants to trade for an Epic/Shiny fish.";
            }
            break;
			
        case "weed":
            if (wagon.professionName === "Gamer") {
                s.message = "Bigfoot introduces himself as Jacob Wysocki. You smoke the bomb kush. Then he tells you the secret of Mount Chilead. 'Obon Srgg unf n wrg cnpx.' He seemed to really be a calming influence on your oxen.";
				wagon.oxenHealth += 10;
            } else {
                s.message = "Bigfoot appreciates you offering some weed. In fact, he pulls out some sativa strain of his own to share with you and then heads back into the woods. He seemed to really be a calming influence on your oxen.";
				wagon.oxenHealth += 10;
            }
            break;

        case "mute":
            s.message = "Bigfoot looks for your 'Mute Button,' shakes his head at your uselessness, and walks away.";
            break;
    }

    const log = eventLog;
    if (log) log.insertAdjacentHTML('afterbegin', `${s.message}<br>`);
    
    if (endEncounter) {
        setTimeout(() => {
            wagon.huntState = null;
            toggleModal("#huntModal");
            textUpdateUI();
        }, 3000);
    }
    renderHuntDashboard();
}

function buildSkillSelector() {
    const content = modalChild;
    // Nudist Run bans Sewing outright — a Gamer can't pick their way around
    // the clothing ban by taking the Tailor's skill instead.
    const availableSkills = Object.values(ProfessionSkills)
        .filter(s => !(pendingChallengeMode === 'nudist' && s === 'Sewing'));
    content.innerHTML = `
        <h3>Gamer Skill Selection</h3>
        <p>Pick two skills to break the game with:</p>
        ${pendingChallengeMode === 'nudist' ? `<p style="color:#e0a83c; font-size:0.85em;">Sewing is off the table this run. Nudist Run means nudist run.</p>` : ''}
        <div id="skill-checkboxes">
            ${availableSkills.map(s => 
                `<label><input type="checkbox" name="skill-pick" value="${s}"> ${s}</label><br>`
            ).join('')}
        </div>
        <button ${actionAttrs('saveGamerSkills')} class="btn btn-success">Save Skills</button>
    `;
    toggleModal("#myModal");
}

function saveGamerSkills() {
    const picked = Array.from(document.querySelectorAll("input[name='skill-pick']:checked"));
    if (picked.length !== 2) {
        alert("Pick exactly two!");
        return;
    }
    
    // Grab the values from the form again to pass them to finalization
    const p1 = document.getElementById("char1").value;
    const p2 = document.getElementById("char2").value;
    const p3 = document.getElementById("char3").value;
    const p4 = document.getElementById("char4").value;
    const p5 = document.getElementById("char5").value;
    
    // Initialize the wagon and characters
    finalizeCharacterSetup("Gamer", p1, p2, p3, p4, p5);
    
    // Assign the specific skills picked in the modal
    wagon.skill = picked.map(p => p.value);
    
    toggleModal("#myModal");
}

function hasSkill(skillName) {
    if (!wagon || !wagon.skill) return false; // Prevent 'undefined' errors
    if (Array.isArray(wagon.skill)) {
        return wagon.skill.includes(skillName);
    }
    return wagon.skill === skillName;
}

function finalizeCharacterSetup(prof, p1, p2, p3, p4, p5) {
    isGameStarting = true;
	// Validate and Transition
    if (validateNames(prof, p1, p2, p3, p4, p5)) {
        char1 = new Character(p1, 1);
        char2 = new Character(p2, 2);
        char3 = new Character(p3, 3);
        char4 = new Character(p4, 4);
        char5 = new Character(p5, 5);
        
        // Attach to window for textUpdateUI
        window.char1 = char1;
        window.char2 = char2;
        window.char3 = char3;
        window.char4 = char4;
        window.char5 = char5;

        wagon = new Wagon();
        fetchScoreToken(); // arm the score-submission session for this run
        if (pendingChallengeMode) {
            wagon.challengeMode = pendingChallengeMode;
            pendingChallengeMode = null;
            if (wagon.challengeMode === 'winter') {
                // A September departure: mild now, but October is already
                // cooling and the passes will be deep in snow by the time
                // you reach them. The existing month-based weather system
                // does the rest.
                wagon.month = "September";
                wagon.day = 1;
            }
        }
        updateStoreUnitPrices();
        applyVegetarianButtonLock();
        applyNoSaveButtonLock();
        if (pendingDailyChallenge) {
            // This run is today's Daily Challenge: tag it (drives leaderboard
            // routing) and give the saloon a date-derived seed so even the
            // card tables are identical worldwide.
            wagon.dailyChallenge = pendingDailyChallenge;
            wagon.gamblingSeed = hashDailySeed(pendingDailyChallenge + "-saloon");
            pendingDailyChallenge = null;
        }

		wagon.flags = {
			bigfoot_blanket: false,
			bigfoot_piss: false,
			bigfoot_talisman: false,
			bunny: false,
			cheated: false,
			dog_name: false,
			found_diary: false,
			ghost_protection: false,
			glitch: false,
			has_dog: false,
			had_dusty: false,
			has_epic_fish: false,
			hasMournedThisStop: false,
			jesus_took_wheel: false,
			jesus_wine: false,
			masonic_handshake: false,
			monolith: false,
			robbed_ghost: false,
			selfie: false,
			shaman: false,
			traveler_thankful: false,
			union_leader: false,
		};
       
        const diffDropdown = document.getElementById("difficulty");
        wagon.difficulty = diffDropdown ? diffDropdown.value : "Normal";
        // Belt-and-suspenders against the disabled <option> being bypassed
        // (e.g. via devtools) — New Game+ requires having actually earned it.
        if (wagon.difficulty === 'New Game+' && !hasBeatenGameOnce()) {
            wagon.difficulty = 'Normal';
        }
        // New Game+ isn't just Hard again — every scale in the game that reads diffMultiplier (weapon damage, hit chance, fishing HP,
        // gather/prospect rolls, fail thresholds) pushes further in the "harder" direction than Hard ever did.
        const diffMap = { "Easy": 1.1, "Normal": 1.0, "Hard": 0.9, "New Game+": 0.7 };
        wagon.diffMultiplier = diffMap[wagon.difficulty] || 1.0;
        if (wagon.difficulty === 'New Game+') {
            applyNewGamePlusCarryover();
        }
        const trailEl = document.getElementById("trail-choice");
        wagon.route = trailEl ? trailEl.value : "Oregon";
        const draftAnimalEl = document.getElementById("draft-animal-choice");
        wagon.draftAnimal = (draftAnimalEl && DRAFT_ANIMALS[draftAnimalEl.value]) ? draftAnimalEl.value : "Oxen";
        updateStoreUnitPrices(); // re-run now that draftAnimal is actually known — the earlier call ran before this was set
        if (wagon.challengeMode === 'ghost') {
            wagon.ghostRace = loadGhostForRoute(wagon.route);
            if (!wagon.ghostRace) {
                // No ghost recorded for this route yet — this run becomes
                // the recording. Honest fallback instead of a dead end.
                updateActionPrompt(`No phantom has finished the ${wagon.route} trail yet. This run will be recorded as the ghost to beat.`);
            }
        }        
        wagon.characters.push(char1, char2, char3, char4, char5);
        wagon.profession(prof);
		if (wagon.professionName === "Gamer") {
			AchievementManager.unlock('gamer', 'Playing with Power');
		}

		if (wagon.route === "Random" || wagon.route === "Ironman") {
			const allKeys = Object.keys(Landmarks);
			const randomStartKey = allKeys[Math.floor(Math.random() * allKeys.length)];
			wagon.currentLandmark = randomStartKey;
			wagon.pathHistory = [randomStartKey];
			
			const availableKeys = allKeys.filter(k => k !== randomStartKey);
			wagon.nextLandmark = availableKeys[Math.floor(Math.random() * availableKeys.length)];
			wagon.milesToNextLandmark = Math.floor(Math.random() * 201) + 50; // 50 to 250 miles
		} else if (wagon.route === "UNO Reverse") {
			wagon.currentLandmark = "Willamette Valley";
			wagon.nextLandmark = "The Dalles";
			wagon.milesToNextLandmark = 100;
		} else {
			wagon.currentLandmark = "Independence";
			const startingLoc = Landmarks["Independence"];
			wagon.nextLandmark = startingLoc.getNext ? startingLoc.getNext(wagon.route) : startingLoc.next[0];		
			const distIndex = startingLoc.next.indexOf(wagon.nextLandmark); 
			wagon.milesToNextLandmark = startingLoc.distanceToNext[distIndex >= 0 ? distIndex : 0];
		}
		wagon.calculateEnvironment();
		isGameStarting = false;

		// Setting-out weight check: warn if the initial shopping spree exceeds what the team can pull, while the player is still standing next to a store.
		const setOutWarning = wagon.weightWarningText();
		if (setOutWarning) {
			eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#b8860b;">⚖️ ${setOutWarning}</span><br>`);
			updateActionPrompt(translateSanity(setOutWarning));
		}
      
        const firstLandmark = document.getElementById('landmark-graphic');
        const firstLayer = document.getElementById('layer-landmark');
        if (firstLandmark && firstLayer) {
            firstLandmark.src = "img/landmarks/1.png";
            firstLandmark.style.display = 'block';
            firstLayer.style.left = '95%'; 
            firstLayer.style.display = 'flex';
        }
        
    const gameScreen = document.getElementById('gameMainScreen');
    if (wagon.difficulty === "Hard" || wagon.difficulty === "New Game+") {
        // High contrast, slight sepia, and a tiny bit of blur to make it "gritty"
        gameScreen.style.filter = "contrast(120%) sepia(20%) brightness(90%) hue-rotate(-5deg)";
		gameScreen.classList.add('hard-mode-glitch');
		AudioManager.playSound('hard');
    } else {
        gameScreen.style.filter = "none";
		gameScreen.classList.remove('hard-mode-glitch');
    }

        textUpdateUI();
        wagon.characters.forEach(c => c.healthBar());
    }
    if (wagon.difficulty === "New Game+") {
        updateActionPrompt("NEW GAME+: You've done this before. I will not go easier on you for that.");
		eventLog.insertAdjacentHTML('afterbegin', `NEW GAME+: You've done this before. I will not go easier on you for that.<br>`);
    }
    else if (wagon.difficulty === "Hard") {
        updateActionPrompt("HARD: Permadeath is a lifestyle choice. I can respect that.");
		eventLog.insertAdjacentHTML('afterbegin', `HARD: Permadeath is a lifestyle choice. I can respect that.<br>`);
    } 
    else if (wagon.difficulty === "Easy") {
        updateActionPrompt("Easy: If you are just here for nostalgia and laughs rather than a challenge, I won't judge. Others will, but I won't.");
		eventLog.insertAdjacentHTML('afterbegin', `Easy: If you are just here for nostalgia and laughs rather than a challenge, I won't judge. Others will, but I won't.<br>`);
    }
    else {
        updateActionPrompt("Normal: Honestly, maybe a little harder than the original Apple II version but that was aimed at little kids.");
		eventLog.insertAdjacentHTML('afterbegin', `Normal: Honestly, maybe a little harder than the original Apple II version but that was aimed at little kids.<br>`);
    }

    if (wagon.route === "California") {
        updateActionPrompt("System: Route set to 'Grim/California'. Welcome to the Donner Party.");
		eventLog.insertAdjacentHTML('afterbegin', `System: Route set to 'Grim/California'. Welcome to the Donner Party.<br>`);
    } 
    else if (wagon.route === "Mormon") {
        updateActionPrompt("System: Mormon/Religious Freedom mode activated. Gathering followers.");
		eventLog.insertAdjacentHTML('afterbegin', `System: Mormon/Religious Freedom mode activated. Gathering followers.<br>`);
    }
    else if (wagon.route === "Santa Fe") {
        updateActionPrompt("System: Santa Fe/Merchant Mode enabled. 'Everything has a price' protocol active.");
		eventLog.insertAdjacentHTML('afterbegin', `System: Santa Fe/Merchant Mode enabled. 'Everything has a price' protocol active.<br>`);
    }
    else if (wagon.route === "Bozeman") {
        updateActionPrompt("System: BOZEMAN/HARDCORE MODE ENABLED. Warning: Survival is not a game mechanic here.");
		eventLog.insertAdjacentHTML('afterbegin', `System: BOZEMAN/HARDCORE MODE ENABLED. Warning: Survival is not a game mechanic here.<br>`);
    }
    else if (wagon.route === "UNO Reverse") {
        updateActionPrompt("System: UNO REVERSE MODE ENABLED. Warning: Moving to Missouri should not be a goal.");
		eventLog.insertAdjacentHTML('afterbegin', `System: UNO REVERSE MODE ENABLED. Warning: Moving to Missouri should not be a goal.<br>`);
    }
	else if (wagon.route === "Random") {
        updateActionPrompt("System: RANDOM MODE ENABLED. Warning: Expect shit to break.");
		eventLog.insertAdjacentHTML('afterbegin', `System: RANDOM MODE ENABLED. Warning: Expect shit to break.<br>`);
    }
    else if (wagon.route === "Ironman") {
        updateActionPrompt("System: IRONMAN MODE ENABLED. Warning: This does not give you the money and abilities of Tony Stark. Survive as long as you can.");
		eventLog.insertAdjacentHTML('afterbegin', `System: IRONMAN MODE ENABLED. Warning: This does not give you the money and abilities of Tony Stark. Survive as long as you can.<br>`);
		AudioManager.playSound('ironman');
    }
	
    else {
        updateActionPrompt("System: Route set to 'Oregon/Nostalgia'. Welcome to computer time at school.");
		eventLog.insertAdjacentHTML('afterbegin', `System: Route set to 'Oregon/Nostalgia'. Welcome to computer time at school.<br>`);
    }

    AchievementManager.data.stats.tombstonesMourned = 0;
    AchievementManager.data.stats.animalsHuntedThisRun = 0;
    AchievementManager.save();
	isGameStarting = false;
}

function computeGatherRequiredClicks(resourceKey) {
    let required = GATHER_RESOURCE_INFO[resourceKey].clicksBase;
    if (hasSkill("Survival")) required *= 0.75;
    required *= difficultyIntensityScale();
    return Math.max(3, Math.round(required));
}

function trailblazeLockedOut() {
    return !!(wagon && wagon.flags && wagon.flags.lastShortcutZone === wagon.currentZone);
}

function openPreparationsMenu() {
    const content = modalChild;
    if (!content) return;
    const tbLocked = trailblazeLockedOut();
    content.innerHTML = `
        <div style="text-align:center; padding: 20px; background:#1a1005; color:#eee;">
            <h3>🏕️ Preparations</h3>
            <p style="font-size:0.9em; color:#ccc; max-width:420px; margin:0 auto;">Spend the whole day getting ready instead of moving — you'll still eat, drink, and age a day like any other. You just won't cover any ground (except Trailblaze, which is the point).</p>
            <div class="buttons" style="flex-direction:column; align-items:stretch; gap:8px; max-width:380px; margin:16px auto 0;">
                <button class="btn btn-warning" ${tbLocked ? 'disabled' : actionAttrs('startTrailblazeGame', [], { noTitle: true })} title="${tbLocked ? "You already found the one shortcut through this stretch of country. Wait for a new zone." : "Pipe-connect a shortcut. Get it wrong and you get lost instead."}">🗺️ Trailblaze</button>
                <button class="btn btn-warning" ${actionAttrs('startTendHerdGame', [], { noTitle: true })} title="Groom and check over your team.">🐴 Tend the Herd</button>
                <button class="btn btn-warning" ${actionAttrs('startScoutGame', [], { noTitle: true })} title="Spot the real danger before it passes by.">🔭 Scout</button>
                <button class="btn btn-warning" ${actionAttrs('startDiplomacyGame', [], { noTitle: true })} title="A respectful greeting can go a long way out here.">🤝 Diplomacy</button>
                <button class="btn btn-warning" ${actionAttrs('startDoctorsRoundsGame', [], { noTitle: true })} title="An ounce of prevention, if you've got the ounce.">⚕️ Doctor's Rounds</button>
                <button class="btn btn-warning" ${actionAttrs('startTuneWagonGame', [], { noTitle: true })} title="A stitch in time saves nine spokes.">🔧 Tune the Wagon</button>
                <button class="btn btn-warning" ${actionAttrs('startTargetPracticeGame', [], { noTitle: true })} title="Bottles and cans. No animals involved.">🎯 Target Practice</button>
            </div>
            <div class="buttons" style="margin-top:16px;">
                <button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Never mind, back on the road.">Never Mind</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function sharpshooterBonus() {
    if (wagon && wagon.flags && wagon.flags.sharpshooterUntilDay && wagon.days <= wagon.flags.sharpshooterUntilDay) {
        return wagon.flags.sharpshooterBonus || 0;
    }
    return 0;
}

function trailblazeTypicalDistance() {
    if (!wagon) return 0;
    const basePace = 15; // midpoint of turn()'s 12-18 daily roll
    let paceMultiplier = 1.0;
    if (wagon.pace === "Strenuous") paceMultiplier = 1.5;
    if (wagon.pace === "Grueling") paceMultiplier = 2.0;

    let teamModifier = 1.0;
    if (wagon.oxen < 2) teamModifier = 0;
    else if (wagon.oxen < 6) teamModifier = 0.7;
    else if (wagon.oxen > 8) teamModifier = 1.1;

    const healthPenalty = (wagon.oxenHealth < 50) ? 0.5 : 1.0;
    const animalCfg = getDraftAnimalConfig(wagon.draftAnimal);
    let distance = basePace * paceMultiplier * teamModifier * healthPenalty * animalCfg.paceModifier * (wagon.diffMultiplier || 1.0);

    const loadRatio = wagon.getLoadRatio();
    if (loadRatio > 1.0) {
        const weightFactor = Math.max(0.5, 1 - (loadRatio - 1) * 0.5);
        distance *= weightFactor;
    }
    return Math.max(0, distance);
}

const TrailblazeGame = {
    cols: 7,
    rows: 4,
    timeLimit: 40,
    grid: [],
    startCell: null,
    endCell: null,
    timerInterval: null,
    timeLeft: 0,
    ended: false,

    difficultySettings() {
        const table = {
            "Easy":       { cols: 7,  rows: 5, secPerPiece: 2.6, baseBuffer: 8 },
            "Normal":     { cols: 8,  rows: 5, secPerPiece: 2.0, baseBuffer: 6 },
            "Hard":       { cols: 9,  rows: 6, secPerPiece: 1.5, baseBuffer: 5 },
            "New Game+":  { cols: 10, rows: 6, secPerPiece: 1.2, baseBuffer: 4 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    connections(cell) {
        if (cell.type === 'stub') return [cell.dir];
        if (cell.type === 'straight') return (cell.rot % 2 === 0) ? ['W', 'E'] : ['N', 'S'];
        const table = [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']]; // rot 0,1,2,3
        return table[cell.rot % 4];
    },

    pieceForConnection(sideA, sideB) {
        const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
        if (OPPOSITE[sideA] === sideB) {
            return { type: 'straight', correctRot: (sideA === 'W' || sideA === 'E') ? 0 : 1 };
        }
        const table = [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']];
        for (let rot = 0; rot < 4; rot++) {
            const [a, b] = table[rot];
            if ((a === sideA && b === sideB) || (a === sideB && b === sideA)) {
                return { type: 'curve', correctRot: rot };
            }
        }
        return { type: 'straight', correctRot: 0 }; // unreachable, but never leave a cell undefined
    },

    findSolutionPath(rows, cols, midRow) {
        const goalR = midRow, goalC = cols - 2;
        const startR = midRow, startC = 0;
        const endR = midRow, endC = cols - 1;
        const visited = new Set();
        const path = [];
        const key = (r, c) => `${r},${c}`;
        let steps = 0;
        const STEP_CAP = 20000;

        const isReserved = (r, c) => (r === startR && c === startC) || (r === endR && c === endC);

        const shuffledNeighbors = (r, c) => {
            const opts = [];
            if (r > 0) opts.push([r - 1, c]);
            if (r < rows - 1) opts.push([r + 1, c]);
            if (c > 0) opts.push([r, c - 1]);
            if (c < cols - 1) opts.push([r, c + 1]);
            const filtered = opts.filter(([nr, nc]) => !isReserved(nr, nc));
            for (let i = filtered.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
            }
            return filtered;
        };

        const dfs = (r, c) => {
            steps++;
            if (steps > STEP_CAP) return false;
            visited.add(key(r, c));
            path.push([r, c]);
            if (r === goalR && c === goalC) return true;
            for (const [nr, nc] of shuffledNeighbors(r, c)) {
                if (visited.has(key(nr, nc))) continue;
                if (dfs(nr, nc)) return true;
            }
            path.pop();
            visited.delete(key(r, c));
            return false;
        };

        if (dfs(midRow, 1)) return path;

        const straight = [];
        for (let c = 1; c <= goalC; c++) straight.push([midRow, c]);
        return straight;
    },

    buildGrid() {
        const settings = this.difficultySettings();
        this.cols = settings.cols;
        this.rows = settings.rows;

        const midRow = Math.floor(this.rows / 2);
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({ type: Math.random() < 0.5 ? 'straight' : 'curve', rot: Math.floor(Math.random() * 4), fixed: false });
            }
            this.grid.push(row);
        }

        this.startCell = { row: midRow, col: 0 };
        this.grid[midRow][0] = { type: 'stub', rot: 0, fixed: true, dir: 'E' };
        this.endCell = { row: midRow, col: this.cols - 1 };
        this.grid[midRow][this.cols - 1] = { type: 'stub', rot: 0, fixed: true, dir: 'W' };

        const interiorPath = this.findSolutionPath(this.rows, this.cols, midRow);
        this.timeLimit = Math.round(settings.baseBuffer + interiorPath.length * settings.secPerPiece);
        const fullPath = [[midRow, 0], ...interiorPath, [midRow, this.cols - 1]];
        const DIR = (r1, c1, r2, c2) => {
            if (r2 === r1 - 1) return 'N';
            if (r2 === r1 + 1) return 'S';
            if (c2 === c1 + 1) return 'E';
            return 'W';
        };
        const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
        for (let i = 1; i < fullPath.length - 1; i++) {
            const [r, c] = fullPath[i];
            const [pr, pc] = fullPath[i - 1];
            const [nr, nc] = fullPath[i + 1];
            const entrySide = OPPOSITE[DIR(pr, pc, r, c)];
            const exitSide = DIR(r, c, nr, nc);
            const { type } = this.pieceForConnection(entrySide, exitSide);
            // Scrambled rotation on purpose — only the TYPE is guaranteed
            // correct. Getting it pointing the right way is the puzzle.
            this.grid[r][c] = { type, rot: Math.floor(Math.random() * 4), fixed: false };
        }
    },

    bfsFromStart() {
        const DIR_DELTA = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
        const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
        const key = (r, c) => `${r},${c}`;
        const visited = new Set([key(this.startCell.row, this.startCell.col)]);
        const queue = [this.startCell];
        while (queue.length) {
            const { row, col } = queue.shift();
            const conns = this.connections(this.grid[row][col]);
            for (const dir of conns) {
                const [dx, dy] = DIR_DELTA[dir];
                const nr = row + dy, nc = col + dx;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
                const k = key(nr, nc);
                if (visited.has(k)) continue;
                if (this.connections(this.grid[nr][nc]).includes(OPPOSITE[dir])) {
                    visited.add(k);
                    queue.push({ row: nr, col: nc });
                }
            }
        }
        return visited;
    },

    isConnected() {
        return this.bfsFromStart().has(`${this.endCell.row},${this.endCell.col}`);
    },

    progress() {
        return this.bfsFromStart().size / (this.rows * this.cols);
    },

    start() {
        this.ended = false;
        this.buildGrid(); // sets cols/rows/timeLimit (path-length-derived) for the current difficulty
        this.timeLeft = this.timeLimit;
        const timerEl = document.getElementById('trailblaze-timer');
        if (timerEl) timerEl.textContent = this.timeLeft;
        this.render();
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.tick(), 1000);
    },

    tick() {
        if (this.ended) return;
        this.timeLeft--;
        const timerEl = document.getElementById('trailblaze-timer');
        if (timerEl) timerEl.textContent = this.timeLeft;
        if (this.timeLeft <= 0) this.submit();
    },

    rotate(row, col) {
        if (this.ended) return;
        const cell = this.grid[row][col];
        if (cell.fixed) return;
        cell.rot = (cell.rot + 1) % 4;
        AudioManager.playSound('key');
        this.render();
    },

    submit() {
        if (this.ended) return;
        this.ended = true;
        clearInterval(this.timerInterval);
        resolveTrailblazeGame(this.isConnected(), this.timeLeft, this.timeLimit, this.progress());
    },

    pieceSVG(cell) {
        let path;
        if (cell.type === 'stub') {
            const half = { N: 'M20,0 L20,20', S: 'M20,20 L20,40', E: 'M20,20 L40,20', W: 'M0,20 L20,20' };
            path = half[cell.dir];
        } else if (cell.type === 'straight') {
            path = 'M0,20 L40,20';
        } else {
            path = 'M20,0 L20,20 L40,20'; // N-E curve, rot=0
        }
        const rotDeg = (cell.type === 'stub') ? 0 : cell.rot * 90;
        return `<svg viewBox="0 0 40 40" width="100%" height="100%" style="transform: rotate(${rotDeg}deg);">
            <path d="${path}" stroke="#c8894a" stroke-width="9" fill="none" stroke-linecap="round"/>
        </svg>`;
    },

    render() {
        const gridEl = document.getElementById('trailblaze-grid');
        if (!gridEl) return;
        const visited = this.bfsFromStart();
        let html = '';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                const isStart = (r === this.startCell.row && c === this.startCell.col);
                const isEnd = (r === this.endCell.row && c === this.endCell.col);
                const lit = visited.has(`${r},${c}`);
                const bg = isStart ? '#2d6a4f' : isEnd ? '#7a2d2d' : '#3a2a1a';
                const glow = lit ? 'box-shadow: inset 0 0 0 3px #ffd700;' : '';
                html += `<div class="trailblaze-cell" style="background:${bg}; ${glow} cursor:${cell.fixed ? 'default' : 'pointer'};" ${cell.fixed ? '' : `onclick="TrailblazeGame.rotate(${r},${c})"`}>${this.pieceSVG(cell)}</div>`;
            }
        }
        gridEl.innerHTML = html;
    }
};

function startTrailblazeGame() {
    const content = modalChild;
    if (!content) return;
    if (trailblazeLockedOut()) {
        openPreparationsMenu();
        return;
    }
    const settings = TrailblazeGame.difficultySettings();
    content.innerHTML = `
        <div style="text-align:center; padding: 16px; background:#1a1005; color:#eee;">
            <h3>🗺️ Trailblaze</h3>
            <p style="font-size:0.85em; max-width:480px; margin:0 auto 10px;">Connect the camp (green) to the trail ahead (red) before the clock runs out. Click a pipe to rotate it — gold outlines show what's currently connected to camp. Get it wrong and you don't just fail to save time — you get lost.</p>
            <p>Time left: <span id="trailblaze-timer" style="font-weight:bold; color:#ffd700;">…</span>s</p>
            <div id="trailblaze-grid" style="display:grid; grid-template-columns: repeat(${settings.cols}, 1fr); gap:2px; max-width:${settings.cols * 80}px; margin:10px auto; border:2px solid #555;"></div>
            <div class="buttons">
                <button class="btn btn-success" onclick="TrailblazeGame.submit()">Lock It In</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    TrailblazeGame.start();
}

function resolveTrailblazeGame(success, timeLeft, timeLimit, progress) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return; // game over is already showing

    const typicalDistance = trailblazeTypicalDistance();
    let msg, subMsg, sound;

    if (success) {
        // 2.5x at the buzzer, up to 4x with real time to spare.
        const speedRatio = Math.max(0, Math.min(1, timeLeft / timeLimit));
        const multiplier = 2.5 + speedRatio * 1.5;
        const bonus = Math.max(1, Math.round(typicalDistance * multiplier));
        wagon.milesToNextLandmark = Math.max(0, wagon.milesToNextLandmark - bonus);
        wagon.totalDistance += bonus;
        // One successful shortcut per geographic zone — otherwise this was
        // just a repeatable button that trivialized the whole trail. Clears
        // itself naturally the moment wagon.currentZone actually changes.
        if (!wagon.flags) wagon.flags = {};
        wagon.flags.lastShortcutZone = wagon.currentZone;
        sound = 'trade';
        msg = `You found it — a real shortcut, and the pipe connected clean. ${bonus} miles closer to the next stop.`;
        subMsg = `A rig covering about ${typicalDistance.toFixed(0)} mi on a normal day turned into a ${multiplier.toFixed(1)}x shortcut today. You won't find another one out here — maybe the next stretch of country.`;
        AchievementManager.unlock('shortcut_king', 'Shortcut King');
    } else if (progress < 0.35) {
        // Barely connected anything to camp at all — that's not a near
        // miss, that's a wrong turn.
        const penalty = Math.max(1, Math.round(typicalDistance * 0.5));
        wagon.milesToNextLandmark += penalty;
        sound = 'miss';
        msg = `No route through, and not even close — somewhere in there you took a real wrong turn.`;
        subMsg = `You're now ${penalty} miles further from the next stop than when the day started. That's the gamble.`;
    } else {
        sound = 'miss';
        msg = `Close, but the pipe never connected all the way through. The day's gone and you're no closer to the next stop.`;
        subMsg = `At least you didn't make it worse.`;
    }

    AudioManager.playSound(sound);
    updateActionPrompt(translateSanity(msg));
    eventLog.insertAdjacentHTML('afterbegin', `${msg} ${subMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🗺️ Trailblaze</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const TendHerdGame = {
    // Percentages of the image's own box (left, top, width, height).
    zones: [
        { label: 'Head',       x: 0,  y: 20, w: 24, h: 45 },
        { label: 'Mane',       x: 3,  y: 0,  w: 39, h: 28 },
        { label: 'Front Legs', x: 27, y: 70, w: 26, h: 30 },
        { label: 'Flank',      x: 38, y: 22, w: 40, h: 48 },
        { label: 'Back Legs',  x: 65, y: 70, w: 27, h: 30 },
        { label: 'Rump',       x: 78, y: 15, w: 21, h: 55 },
    ],
    total: 6,
    order: [],
    index: 0,
    hits: 0,
    clicksOnCurrent: 0,
    clicksNeeded: 2,
    baseWindow: 1200,
    stubbornIndex: -1,
    timeoutId: null,
    ended: false,

    difficultySettings() {
        const table = {
            "Easy":       { windowMult: 1.3, clicksNeeded: 1 },
            "Normal":     { windowMult: 1.0, clicksNeeded: 2 },
            "Hard":       { windowMult: 0.8, clicksNeeded: 2 },
            "New Game+":  { windowMult: 0.65, clicksNeeded: 3 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    speciesImage() {
        const map = { Oxen: 'ox.png', Mules: 'mule.png', Horses: 'horse.png' };
        return map[wagon && wagon.draftAnimal] || 'ox.png';
    },

    start() {
        this.ended = false;
        this.hits = 0;
        this.index = 0;
        this.clicksOnCurrent = 0;

        const diff = this.difficultySettings();
        this.clicksNeeded = diff.clicksNeeded;
        const baseWindowBySpecies = wagon.draftAnimal === "Horses" ? 900 : wagon.draftAnimal === "Mules" ? 1200 : 1500;
        this.baseWindow = Math.round(baseWindowBySpecies * diff.windowMult);
        this.stubbornIndex = wagon.draftAnimal === "Mules" ? Math.floor(Math.random() * this.total) : -1;

        // A fresh shuffled order every run — no more "click the same six
        // zones in the same order every time."
        this.order = [...Array(this.total).keys()];
        for (let i = this.order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
        }

        this.render();
        this.nextSpot();
    },

    render() {
        const stage = document.getElementById('tend-herd-stage');
        if (!stage) return;
        // Brush cursor for the whole stage — child zone elements inherit it
        // unless they override cursor themselves (they no longer do).
        stage.style.cursor = `url('${getImagePath('./img/brush.png')}') 32 32, pointer`;
        const zoneDivs = this.zones.map((z, i) =>
            `<div id="tend-zone-${i}" class="tend-herd-zone" style="position:absolute; left:${z.x}%; top:${z.y}%; width:${z.w}%; height:${z.h}%;"></div>`
        ).join('');
        stage.innerHTML = `
            <img src="${getImagePath('./img/' + this.speciesImage())}" alt="Groom the team" draggable="false"
                 style="width:100%; display:block; user-select:none; -webkit-user-drag:none; pointer-events:none; border-radius:8px;">
            ${zoneDivs}
        `;
    },

    nextSpot() {
        if (this.ended) return;
        if (this.index >= this.total) { this.finish(); return; }
        const i = this.order[this.index];
        this.clicksOnCurrent = 0;
        const zoneEl = document.getElementById(`tend-zone-${i}`);
        if (!zoneEl) return;
        const isStubborn = (i === this.stubbornIndex);
        zoneEl.style.border = `3px solid ${isStubborn ? '#e04b32' : '#ffd700'}`;
        zoneEl.style.borderRadius = '14px';
        zoneEl.style.boxShadow = `0 0 16px ${isStubborn ? '#e04b32' : '#ffd700'}`;
        zoneEl.style.background = `${isStubborn ? 'rgba(224,75,50,0.15)' : 'rgba(255,215,0,0.15)'}`;
        zoneEl.onclick = () => this.click(i);
        // The indicator: a callout label anchored above the active zone,
        // right on top of the artwork, so the player never has to guess
        // which region on the animal is currently lit up.
        zoneEl.innerHTML = `<div style="position:absolute; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:6px; background:#000; color:${isStubborn ? '#ff8866' : '#ffd700'}; padding:2px 10px; border-radius:6px; white-space:nowrap; font-size:0.78em; font-weight:bold; border:1px solid ${isStubborn ? '#e04b32' : '#ffd700'};">${this.zones[i].label}${this.clicksNeeded > 1 ? ` (0/${this.clicksNeeded})` : ''}</div>`;
        this.armTimeout(i, isStubborn);
    },

    armTimeout(i, isStubborn) {
        clearTimeout(this.timeoutId);
        const windowMs = isStubborn ? Math.round(this.baseWindow * 0.55) : this.baseWindow;
        this.timeoutId = setTimeout(() => this.miss(i), windowMs);
    },

    click(i) {
        this.clicksOnCurrent++;
        const zoneEl = document.getElementById(`tend-zone-${i}`);
        AudioManager.playSound('key');
        if (this.clicksOnCurrent >= this.clicksNeeded) {
            clearTimeout(this.timeoutId);
            if (zoneEl) {
                zoneEl.style.border = '3px solid #2d6a4f';
                zoneEl.style.boxShadow = '0 0 10px #2d6a4f';
                zoneEl.style.background = 'rgba(45,106,79,0.2)';
                zoneEl.onclick = null;
                zoneEl.innerHTML = '';
            }
            this.hits++;
            this.index++;
            this.nextSpot();
        } else {
            // Every click re-arms a fresh window, so a multi-click zone is a
            // rapid burst, not "click it once anytime in one long window."
            const isStubborn = (i === this.stubbornIndex);
            if (zoneEl) {
                zoneEl.innerHTML = `<div style="position:absolute; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:6px; background:#000; color:${isStubborn ? '#ff8866' : '#ffd700'}; padding:2px 10px; border-radius:6px; white-space:nowrap; font-size:0.78em; font-weight:bold; border:1px solid ${isStubborn ? '#e04b32' : '#ffd700'};">${this.zones[i].label} (${this.clicksOnCurrent}/${this.clicksNeeded})</div>`;
            }
            this.armTimeout(i, isStubborn);
        }
    },

    miss(i) {
        const zoneEl = document.getElementById(`tend-zone-${i}`);
        if (zoneEl) {
            zoneEl.style.border = '3px solid #555';
            zoneEl.style.boxShadow = 'none';
            zoneEl.style.background = 'rgba(80,80,80,0.15)';
            zoneEl.onclick = null;
            zoneEl.innerHTML = '';
        }
        this.index++;
        this.nextSpot();
    },

    finish() {
        this.ended = true;
        resolveTendHerdGame(this.hits, this.total);
    }
};

function startTendHerdGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    const flavor = wagon.draftAnimal === "Mules" ? "One of your mules won't make this easy."
        : wagon.draftAnimal === "Horses" ? "Horses are quick — don't blink."
        : wagon.draftAnimal === "Mechanical Bull" ? "You can't groom a mechanical bull. This was never going to go well."
        : "Oxen are patient about this, at least.";
    const diff = TendHerdGame.difficultySettings();
    const clickHint = diff.clicksNeeded > 1
        ? `A spot lights up on your team, in a random order each time — click it ${diff.clicksNeeded} times fast before the window closes.`
        : `A spot lights up on your team, in a random order each time — click it before the window closes.`;
    content.innerHTML = `
        <div style="text-align:center; padding:16px;">
            <h3>🐴 Tend the Herd</h3>
            <p style="font-size:0.85em; max-width:420px; margin:0 auto 10px;">${clickHint} ${flavor}</p>
            <div id="tend-herd-stage" style="position:relative; display:inline-block; width:100%; max-width:380px; margin:0 auto;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    TendHerdGame.start();
}

function resolveTendHerdGame(hits, total) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;

    const accuracy = hits / total;
    // Mechanical Bull can't benefit from this at all — nothing to heal.
    const healthGain = (wagon.draftAnimal === "Mechanical Bull") ? 0 : Math.round(accuracy * 30);
    wagon.oxenHealth = Math.min(100, wagon.oxenHealth + healthGain);

    let msg;
    if (wagon.draftAnimal === "Mechanical Bull") {
        msg = `You spend the day trying to groom a mechanical bull. It does not appreciate this. Nothing about its condition has changed, because it does not have a condition — it has a warranty, and that warranty is void.`;
    } else if (accuracy >= 0.8) {
        msg = `A thorough once-over — every hoof checked, every strap re-tied. The team looks better for it.`;
    } else if (accuracy >= 0.4) {
        msg = `A decent effort, though a couple of spots got skipped in the shuffle.`;
    } else {
        msg = `Mostly missed opportunities today — the team's about the same as when you started.`;
    }
    const subMsg = (wagon.draftAnimal === "Mechanical Bull") ? '' : `+${healthGain} team health (${hits}/${total}).`;

    AudioManager.playSound(healthGain > 15 ? 'trade' : 'miss');
    const fullMsg = subMsg ? `${msg} ${subMsg}` : msg;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🐴 Tend the Herd</h3>
                <p>${translateSanity(msg)}</p>
                ${subMsg ? `<p style="color:#aaa; font-size:0.85em;">${subMsg}</p>` : ''}
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const ScoutGame = {
    THREATS: [
        { icon: '🏹', label: 'Bandits' },
        { icon: '🐻', label: 'Bear' },
        { icon: '🌊', label: 'Flooded Crossing' },
        { icon: '⚡', label: 'Storm Front' },
        { icon: '🐍', label: 'Snake Den' },
        { icon: '🔥', label: 'Wildfire' },
    ],
    DECOYS: [
        { icon: '🪨', label: 'Just a rock' },
        { icon: '🦌', label: 'Deer' },
        { icon: '🌵', label: 'Scrub brush' },
        { icon: '🐦', label: 'Birds' },
        { icon: '🌳', label: 'Dead tree' },
        { icon: '☁️', label: 'Cloud' },
    ],

    sequence: [],
    index: 0,
    hits: 0,
    misses: 0,
    falsePositives: 0,
    windowMs: 2200,
    ended: false,
    timeoutId: null,

    difficultySettings() {
        const table = {
            "Easy":       { total: 6,  threatRatio: 0.66, windowMs: 2600 },
            "Normal":     { total: 8,  threatRatio: 0.60, windowMs: 2200 },
            "Hard":       { total: 10, threatRatio: 0.55, windowMs: 1800 },
            "New Game+":  { total: 12, threatRatio: 0.50, windowMs: 1500 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    pickRandom(pool, n) {
        const copy = [...pool];
        const picked = [];
        while (picked.length < n && copy.length > 0) {
            picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
        }
        while (picked.length < n) {
            picked.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        return picked;
    },

    start() {
        this.ended = false;
        this.index = 0;
        this.hits = 0;
        this.misses = 0;
        this.falsePositives = 0;

        const diff = this.difficultySettings();
        this.windowMs = diff.windowMs;
        const threatCount = Math.round(diff.total * diff.threatRatio);
        const decoyCount = diff.total - threatCount;

        const threats = this.pickRandom(this.THREATS, threatCount).map(t => ({ ...t, isThreat: true }));
        const decoys = this.pickRandom(this.DECOYS, decoyCount).map(d => ({ ...d, isThreat: false }));
        this.sequence = [...threats, ...decoys];
        for (let i = this.sequence.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.sequence[i], this.sequence[j]] = [this.sequence[j], this.sequence[i]];
        }

        this.render();
        this.nextSighting();
    },

    render() {
        const stage = document.getElementById('scout-stage');
        if (!stage) return;
        stage.innerHTML = `<div id="scout-sighting" style="position:absolute; top:50%; transform:translateY(-50%); left:95%; font-size:3.2em; cursor:pointer; user-select:none; text-shadow:0 2px 4px rgba(0,0,0,0.6);"></div>
            <div id="scout-progress" style="position:absolute; top:8px; left:8px; color:#ffd700; font-size:0.8em; font-weight:bold;"></div>`;
    },

    updateProgress() {
        const el = document.getElementById('scout-progress');
        if (el) el.textContent = `${this.index}/${this.sequence.length}`;
    },

    nextSighting() {
        if (this.ended) return;
        this.updateProgress();
        if (this.index >= this.sequence.length) { this.finish(); return; }
        const sighting = this.sequence[this.index];
        const el = document.getElementById('scout-sighting');
        if (!el) return;
        el.textContent = sighting.icon;
        el.title = sighting.label;
        el.style.transition = 'none';
        el.style.left = '95%';
        el.onclick = (e) => { e.stopPropagation(); this.resolve(sighting, true); };
        void el.offsetWidth;
        el.style.transition = `left ${this.windowMs}ms linear`;
        el.style.left = '2%';

        this.timeoutId = setTimeout(() => this.resolve(sighting, false), this.windowMs);
    },

    resolve(sighting, wasClicked) {
        clearTimeout(this.timeoutId);
        const el = document.getElementById('scout-sighting');
        if (el) { el.onclick = null; el.style.transition = 'none'; }

        if (sighting.isThreat) {
            if (wasClicked) { this.hits++; AudioManager.playSound('key'); }
            else { this.misses++; }
        } else if (wasClicked) {
            this.falsePositives++;
            AudioManager.playSound('miss');
        }
        // Decoys left alone (not clicked) are correctly ignored — no penalty, no sound.
        this.index++;
        this.nextSighting();
    },

    finish() {
        this.ended = true;
        const totalThreats = this.sequence.filter(s => s.isThreat).length;
        resolveScoutGame(this.hits, this.falsePositives, totalThreats);
    }
};

function startScoutGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>🔭 Scout</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">Something's always moving out on the horizon. Click the real dangers — bandits, bear, flood, storm, snakes, fire — before they pass by. Leave the rocks, deer, birds, and clouds alone; clicking those costs you too.</p>
            <div id="scout-stage" style="position:relative; height:140px; max-width:480px; margin:10px auto; background:linear-gradient(to bottom, #4a3420, #1a1005); border:2px solid #555; border-radius:8px; overflow:hidden;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    ScoutGame.start();
}

function resolveScoutGame(hits, falsePositives, totalThreats) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;
    if (!wagon.flags) wagon.flags = {};

    const netScore = Math.max(0, hits - falsePositives);
    const accuracy = totalThreats > 0 ? netScore / totalThreats : 0;

    let msg, subMsg;
    if (accuracy >= 0.7) {
        const days = 3, strength = 0.5;
        wagon.flags.forewarnedUntilDay = wagon.days + days;
        wagon.flags.forewarnedStrength = strength;
        msg = `A good read on the horizon — you know what's out there now, and what to steer wide of.`;
        subMsg = `Reduced chance of accidents and hazards for the next ${days} days.`;
        AudioManager.playSound('trade');
        AchievementManager.unlock('eagle_eye', 'Eagle Eye');
    } else if (accuracy >= 0.35) {
        msg = `A middling scout — you spotted some of it, missed the rest, and second-guessed yourself on a few rocks.`;
        subMsg = `Not enough of a read to change the odds today.`;
        AudioManager.playSound('miss');
    } else {
        msg = `You called a bird an ambush and missed an actual bear. Rough day for a lookout.`;
        subMsg = `No buff — and the day's still gone.`;
        AudioManager.playSound('miss');
    }

    const fullMsg = `${msg} ${subMsg}`;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🔭 Scout</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const DiplomacyGame = {
    gestures: [
        { icon: '🤝', label: 'Open Hand' },
        { icon: '👆', label: 'Point the Way' },
        { icon: '🎁', label: 'Offer a Gift' },
        { icon: '🙂', label: 'Nod' },
        { icon: '☀️', label: 'Gesture to the Sky' },
        { icon: '❤️', label: 'Hand to Heart' },
    ],
    sequence: [],
    playerIndex: 0,
    correctCount: 0,
    showIndex: 0,
    flashMs: 750,
    ended: false,

    difficultySettings() {
        const table = {
            "Easy":       { length: 4, flashMs: 900 },
            "Normal":     { length: 5, flashMs: 750 },
            "Hard":       { length: 6, flashMs: 620 },
            "New Game+":  { length: 7, flashMs: 500 },
        };
        const base = table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
        const flashMs = hasSkill("Trade") ? Math.round(base.flashMs * 1.2) : base.flashMs;
        return { length: base.length, flashMs };
    },

    nation() {
        return (wagon && ZONE_NATIONS[wagon.currentZone]) || "local";
    },

    start() {
        this.ended = false;
        this.playerIndex = 0;
        this.correctCount = 0;
        const diff = this.difficultySettings();
        this.flashMs = diff.flashMs;
        this.sequence = [];
        for (let i = 0; i < diff.length; i++) {
            this.sequence.push(Math.floor(Math.random() * this.gestures.length));
        }
        this.render();
        this.showIndex = 0;
        this.flashNext();
    },

    render() {
        const stage = document.getElementById('diplomacy-stage');
        if (!stage) return;
        stage.innerHTML = `
            <div id="diplomacy-status" style="margin-bottom:12px; font-weight:bold; color:#ffd700;">Watch closely...</div>
            <div id="diplomacy-gestures" style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px;">
                ${this.gestures.map((g, i) =>
                    `<button id="diplomacy-gesture-${i}" class="btn" style="background:#444; color:#eee; font-size:1.7em; width:64px; height:64px; padding:0; transition:background 0.15s;" disabled>${g.icon}</button>`
                ).join('')}
            </div>
        `;
    },

    flashNext() {
        if (this.showIndex >= this.sequence.length) {
            this.beginInput();
            return;
        }
        const g = this.sequence[this.showIndex];
        const btn = document.getElementById(`diplomacy-gesture-${g}`);
        if (btn) { btn.style.background = '#ffd700'; btn.style.color = '#000'; }
        setTimeout(() => {
            if (btn) { btn.style.background = '#444'; btn.style.color = '#eee'; }
            this.showIndex++;
            setTimeout(() => this.flashNext(), Math.round(this.flashMs * 0.25));
        }, Math.round(this.flashMs * 0.75));
    },

    beginInput() {
        const statusEl = document.getElementById('diplomacy-status');
        if (statusEl) statusEl.textContent = 'Your turn — return it, in order.';
        this.gestures.forEach((g, i) => {
            const btn = document.getElementById(`diplomacy-gesture-${i}`);
            if (btn) {
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.onclick = () => this.pick(i);
            }
        });
    },

    pick(i) {
        if (this.ended) return;
        const expected = this.sequence[this.playerIndex];
        const correct = (i === expected);
        const btn = document.getElementById(`diplomacy-gesture-${i}`);
        if (correct) {
            this.correctCount++;
            AudioManager.playSound('key');
            if (btn) { btn.style.background = '#2d6a4f'; }
        } else {
            AudioManager.playSound('miss');
            if (btn) { btn.style.background = '#a33322'; }
        }
        this.playerIndex++;
        const done = !correct || this.playerIndex >= this.sequence.length;
        if (done) {
            this.finish();
        } else {
            setTimeout(() => { if (btn) btn.style.background = '#444'; }, 200);
        }
    },

    finish() {
        this.ended = true;
        this.gestures.forEach((g, i) => {
            const btn = document.getElementById(`diplomacy-gesture-${i}`);
            if (btn) { btn.disabled = true; btn.onclick = null; }
        });
        resolveDiplomacyGame(this.correctCount, this.sequence.length);
    }
};

function startDiplomacyGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    const nation = DiplomacyGame.nation();
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>🤝 Diplomacy</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">Your party crosses paths with ${nation} travelers making use of this same land. Words won't get you far here, but attention will — watch the greeting closely, then return it in the same order.</p>
            <div id="diplomacy-stage" style="max-width:420px; margin:10px auto;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    DiplomacyGame.start();
}

function resolveDiplomacyGame(correctCount, totalLength) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;
    if (!wagon.flags) wagon.flags = {};

    const nation = DiplomacyGame.nation();
    const accuracy = totalLength > 0 ? correctCount / totalLength : 0;

    let msg, subMsg;
    if (accuracy >= 0.8) {
        const days = 4, strength = 0.6;
        wagon.flags.safePassageUntilDay = wagon.days + days;
        wagon.flags.safePassageStrength = strength;
        msg = `The exchange goes well. The ${nation} families you met share what news and goodwill they can, and send you on your way.`;
        subMsg = `Word travels with you — reduced chance of trouble with other people on the trail for the next ${days} days.`;
        AudioManager.playSound('trade');
        AchievementManager.unlock('good_neighbor', 'Good Neighbor');
    } else if (accuracy >= 0.4) {
        msg = `The exchange is polite but incomplete — you clearly meant well, even if you didn't quite get the details right. They part with you all the same.`;
        subMsg = `No lasting effect today, but no harm done either.`;
        AudioManager.playSound('miss');
    } else {
        // Per design direction: the joke here is on the player fumbling it,
        // never on the people they're meeting.
        msg = `You mix up the gestures badly enough that it stops making sense halfway through. The ${nation} you're meeting take it in stride — you, less so.`;
        subMsg = `No buff today. Maybe watch more closely next time.`;
        AudioManager.playSound('miss');
    }

    const fullMsg = `${msg} ${subMsg}`;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🤝 Diplomacy</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const DoctorsRoundsGame = {
    pairs: [
        { symptomIcon: '🤒', symptomLabel: 'Fever',          treatmentIcon: '💧', treatmentLabel: 'Fluids' },
        { symptomIcon: '🤧', symptomLabel: 'Cough',           treatmentIcon: '🍵', treatmentLabel: 'Warm Broth' },
        { symptomIcon: '🩹', symptomLabel: 'Cut',             treatmentIcon: '🧵', treatmentLabel: 'Bandage' },
        { symptomIcon: '😴', symptomLabel: 'Exhaustion',      treatmentIcon: '🛌', treatmentLabel: 'Rest' },
        { symptomIcon: '🤢', symptomLabel: 'Upset Stomach',   treatmentIcon: '🌿', treatmentLabel: 'Herbal Remedy' },
        { symptomIcon: '✅', symptomLabel: 'All Clear',       treatmentIcon: '👍', treatmentLabel: 'Clean Bill' },
    ],
    patients: [],
    index: 0,
    hits: 0,
    windowMs: 2200,
    ended: false,
    timeoutId: null,

    difficultySettings() {
        const table = {
            "Easy":       { windowMs: 2800 },
            "Normal":     { windowMs: 2200 },
            "Hard":       { windowMs: 1700 },
            "New Game+":  { windowMs: 1300 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    start() {
        this.ended = false;
        this.index = 0;
        this.hits = 0;

        const diff = this.difficultySettings();
        // Medical skill: more time to actually read the symptom before acting.
        this.windowMs = hasSkill("Medical") ? Math.round(diff.windowMs * 1.25) : diff.windowMs;

        const living = wagon.characters.filter(c => c.status !== "Dead");
        this.patients = living.map(c => ({ name: c.name, pairIndex: Math.floor(Math.random() * this.pairs.length) }));
        // Keep it from feeling like a non-event with only 1-2 survivors left.
        while (this.patients.length < 3) {
            const fallbackName = living.length ? living[Math.floor(Math.random() * living.length)].name : "a companion";
            this.patients.push({ name: fallbackName, pairIndex: Math.floor(Math.random() * this.pairs.length) });
        }

        this.render();
        this.nextPatient();
    },

    render() {
        const stage = document.getElementById('doctor-stage');
        if (!stage) return;
        stage.innerHTML = `
            <div id="doctor-patient" style="font-size:1.1em; font-weight:bold; color:#ffd700; margin-bottom:4px;"></div>
            <div id="doctor-symptom" style="font-size:3em; margin-bottom:12px;"></div>
            <div id="doctor-treatments" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px;">
                ${this.pairs.map((p, i) =>
                    `<button id="doctor-treat-${i}" class="btn" style="background:#444; color:#eee; font-size:1.4em; width:58px; height:58px; padding:0;" title="${p.treatmentLabel}">${p.treatmentIcon}</button>`
                ).join('')}
            </div>
        `;
    },

    nextPatient() {
        if (this.ended) return;
        if (this.index >= this.patients.length) { this.finish(); return; }
        const patient = this.patients[this.index];
        const pair = this.pairs[patient.pairIndex];
        const nameEl = document.getElementById('doctor-patient');
        const symptomEl = document.getElementById('doctor-symptom');
        if (nameEl) nameEl.textContent = `${patient.name}:`;
        if (symptomEl) { symptomEl.textContent = pair.symptomIcon; symptomEl.title = pair.symptomLabel; }
        this.pairs.forEach((p, i) => {
            const btn = document.getElementById(`doctor-treat-${i}`);
            if (btn) { btn.style.background = '#444'; btn.onclick = () => this.pick(i, patient.pairIndex); }
        });
        this.timeoutId = setTimeout(() => this.resolve(false), this.windowMs);
    },

    pick(chosenIndex, correctIndex) {
        clearTimeout(this.timeoutId);
        this.resolve(chosenIndex === correctIndex);
    },

    resolve(wasCorrect) {
        clearTimeout(this.timeoutId);
        if (wasCorrect) { this.hits++; AudioManager.playSound('key'); }
        else { AudioManager.playSound('miss'); }
        this.index++;
        this.nextPatient();
    },

    finish() {
        this.ended = true;
        resolveDoctorsRoundsGame(this.hits, this.patients.length);
    }
};

function startDoctorsRoundsGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    const medicineNote = wagon.medicine >= 1
        ? "You've got medicine on hand — a good round today means real treatment, not just watching."
        : "You're out of medicine, though — even a good round today is limited to spotting trouble early, not treating it.";
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>⚕️ Doctor's Rounds</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">Check in on the party one at a time. Match what you see to the right response before they wander off. ${medicineNote}</p>
            <div id="doctor-stage" style="max-width:420px; margin:10px auto;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    DoctorsRoundsGame.start();
}

function resolveDoctorsRoundsGame(hits, total) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;
    if (!wagon.flags) wagon.flags = {};

    const accuracy = total > 0 ? hits / total : 0;
    const hasMedicine = wagon.medicine >= 1;

    let msg, subMsg;
    if (accuracy >= 0.35) {
        // Middling rounds still leave a smaller buff — only a genuinely poor
        // round (more misdiagnoses than catches) walks away with nothing.
        const tierMult = accuracy >= 0.7 ? 1.0 : 0.5;
        const medMult = hasMedicine ? 1.0 : 0.45; // reduced, never zero — an exam still has some value
        const days = Math.max(1, Math.round((accuracy >= 0.7 ? 4 : 2) * medMult));
        const strength = Math.round(25 * tierMult * medMult) / 100;

        wagon.flags.checkupUntilDay = wagon.days + days;
        wagon.flags.checkupStrength = strength;

        let treatedName = null;
        if (hasMedicine) {
            wagon.medicine -= 1;
            // Immediate relief for whoever's actually sick right now — the
            // medicine has to go somewhere; the multi-day buff above is on
            // top of this, not instead of it.
            const sick = wagon.characters.find(c => c.status !== "Dead" && c.illness.length > 0);
            if (sick) {
                const ill = sick.illness[0];
                if (ill.severity > 1) { ill.severity -= 1; } else { sick.illness.shift(); }
                sick.health = Math.min(100, sick.health + 10);
                treatedName = sick.name;
            }
        }

        msg = accuracy >= 0.7
            ? `A thorough round — you catch real problems early and treat what you can.`
            : `A decent round — you catch some of it, miss a few, but it's not nothing.`;
        if (!hasMedicine) msg += ` Without medicine on hand, it's mostly just careful watching.`;

        subMsg = treatedName
            ? `${treatedName} is treated on the spot (-1 medicine). Better illness recovery odds for the next ${days} days.`
            : `Better illness recovery odds for the next ${days} days${hasMedicine ? ' (-1 medicine).' : ' — reduced, with no medicine to work with.'}`;

        AudioManager.playSound(accuracy >= 0.7 ? 'trade' : 'miss');
        if (accuracy >= 0.7) AchievementManager.unlock('bedside_manner', 'Bedside Manner');
    } else {
        msg = `You mix up more remedies than you catch problems today. Nobody's worse off, but nobody's better either.`;
        subMsg = `No buff, and no medicine spent.`;
        AudioManager.playSound('miss');
    }

    const fullMsg = `${msg} ${subMsg}`;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>⚕️ Doctor's Rounds</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const TuneWagonGame = {
    total: 9, // 3x3 grid of bolt slots
    order: [],
    index: 0,
    hits: 0,
    windowMs: 1500,
    penaltyMs: 400,
    timeLeftMs: 0,
    tickInterval: null,
    ended: false,

    difficultySettings() {
        const table = {
            "Easy":       { rounds: 6,  windowMs: 1900, penaltyMs: 300 },
            "Normal":     { rounds: 8,  windowMs: 1500, penaltyMs: 400 },
            "Hard":       { rounds: 10, windowMs: 1200, penaltyMs: 500 },
            "New Game+":  { rounds: 12, windowMs: 1000, penaltyMs: 600 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    start() {
        this.ended = false;
        this.hits = 0;
        this.index = 0;

        const diff = this.difficultySettings();
        // Repair skill: a wider window to actually spot which bolt is loose.
        this.windowMs = hasSkill("Repair") ? Math.round(diff.windowMs * 1.3) : diff.windowMs;
        this.penaltyMs = diff.penaltyMs;

        this.order = [];
        for (let i = 0; i < diff.rounds; i++) {
            this.order.push(Math.floor(Math.random() * this.total));
        }

        this.render();
        this.nextRound();
    },

    render() {
        const grid = document.getElementById('tune-wagon-grid');
        if (!grid) return;
        let html = '';
        for (let i = 0; i < this.total; i++) {
            html += `<div id="tune-bolt-${i}" style="width:60px; height:60px; display:flex; align-items:center; justify-content:center; font-size:1.8em; background:#333; border:2px solid #555; border-radius:8px; cursor:pointer;" onclick="TuneWagonGame.click(${i})">🔩</div>`;
        }
        grid.innerHTML = html;
    },

    nextRound() {
        if (this.ended) return;
        if (this.index >= this.order.length) { this.finish(); return; }
        const activeSlot = this.order[this.index];
        const el = document.getElementById(`tune-bolt-${activeSlot}`);
        if (el) {
            el.style.background = '#a33322';
            el.style.borderColor = '#ffd700';
            el.style.boxShadow = '0 0 12px #ffd700';
            el.dataset.active = 'true';
        }
        this.timeLeftMs = this.windowMs;
        clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => {
            this.timeLeftMs -= 50;
            if (this.timeLeftMs <= 0) this.resolveRound(activeSlot, false);
        }, 50);
    },

    click(i) {
        if (this.ended) return;
        const activeSlot = this.order[this.index];
        if (i === activeSlot) {
            this.resolveRound(activeSlot, true);
            return;
        }
        // Wrong bolt: doesn't end the round outright, but burns time off the
        // active window — enough wrong clicks and you'll time out anyway.
        this.timeLeftMs -= this.penaltyMs;
        AudioManager.playSound('miss');
        const el = document.getElementById(`tune-bolt-${i}`);
        if (el && el.dataset.active !== 'true') {
            el.style.background = '#552222';
            setTimeout(() => { if (el.dataset.active !== 'true') el.style.background = '#333'; }, 150);
        }
        if (this.timeLeftMs <= 0) this.resolveRound(activeSlot, false);
    },

    resolveRound(activeSlot, wasHit) {
        clearInterval(this.tickInterval);
        const el = document.getElementById(`tune-bolt-${activeSlot}`);
        if (el) {
            el.style.background = wasHit ? '#2d6a4f' : '#333';
            el.style.borderColor = '#555';
            el.style.boxShadow = 'none';
            el.dataset.active = 'false';
        }
        if (wasHit) { this.hits++; AudioManager.playSound('key'); }
        this.index++;
        this.nextRound();
    },

    finish() {
        this.ended = true;
        resolveTuneWagonGame(this.hits, this.order.length);
    }
};

function startTuneWagonGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    const scrapNote = wagon.firewood >= 2
        ? "You've got spare wood on hand for actual shims and patches — a good pass today means a real fix."
        : "You're low on spare wood, though — even a good pass today is more triage than repair.";
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>🔧 Tune the Wagon</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">Bolts work loose on their own schedule. Click the one that's rattling — the rest are fine for now, and clicking those anyway costs you time. ${scrapNote}</p>
            <div id="tune-wagon-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; max-width:210px; margin:12px auto;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    TuneWagonGame.start();
}

function resolveTuneWagonGame(hits, total) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;
    if (!wagon.flags) wagon.flags = {};

    const accuracy = total > 0 ? hits / total : 0;
    const hasScrap = wagon.firewood >= 2;

    let msg, subMsg;
    if (accuracy >= 0.35) {
        const tierMult = accuracy >= 0.7 ? 1.0 : 0.5;
        const matMult = hasScrap ? 1.0 : 0.45;
        const days = Math.max(1, Math.round((accuracy >= 0.7 ? 5 : 2) * matMult));
        const strength = Math.round(50 * tierMult * matMult) / 100; // up to 50% reduction at full strength

        wagon.flags.tunedUntilDay = wagon.days + days;
        wagon.flags.tunedStrength = strength;

        if (hasScrap) wagon.firewood -= 2;

        msg = accuracy >= 0.7
            ? `A thorough pass — every loose bolt found and tightened, worn parts shimmed up before they can fail.`
            : `A decent pass — you catch the worst of it, but a few things are still a little loose.`;
        if (!hasScrap) msg += ` Without spare wood to work with, it's mostly just tightening what's already there.`;

        subMsg = `Reduced chance of a wheel/axle/tongue breaking for the next ${days} days${hasScrap ? ' (-2 firewood).' : ' — reduced, with nothing to actually patch things up with.'}`;
        AudioManager.playSound(accuracy >= 0.7 ? 'trade' : 'miss');
        if (accuracy >= 0.7) AchievementManager.unlock('grease_monkey', 'Grease Monkey');
    } else {
        msg = `You spend more time chasing rattles than fixing them. The wagon's no better off, but at least you didn't break anything new.`;
        subMsg = `No buff, and no materials spent.`;
        AudioManager.playSound('miss');
    }

    const fullMsg = `${msg} ${subMsg}`;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🔧 Tune the Wagon</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const TargetPracticeGame = {
    realTargets: ['🍾', '🥫'],
    decoys: ['🧸', '🎩', '🚩'],
    decoyChance: 0.3,
    total: 8,
    index: 0,
    hits: 0,
    falsePositives: 0,
    bulletsFired: 0,
    windowMs: 1400,
    ended: false,
    timeoutId: null,
    dryFire: false,
    isDecoyRound: false,

    difficultySettings() {
        const table = {
            "Easy":       { total: 6,  windowMs: 1700 },
            "Normal":     { total: 8,  windowMs: 1400 },
            "Hard":       { total: 10, windowMs: 1100 },
            "New Game+":  { total: 12, windowMs: 900 },
        };
        return table[(wagon && wagon.difficulty) || "Normal"] || table["Normal"];
    },

    start() {
        this.ended = false;
        this.index = 0;
        this.hits = 0;
        this.falsePositives = 0;
        this.bulletsFired = 0;

        const diff = this.difficultySettings();
        // Sharpshooting skill: more time to actually line up the shot.
        this.windowMs = hasSkill("Sharpshooting") ? Math.round(diff.windowMs * 1.25) : diff.windowMs;
        this.dryFire = wagon.bullets <= 0;
        // No longer pre-capped by ammo — decoys mean not every round costs a
        // bullet, so bullets are deducted live as shots are actually fired
        // (see fire() below) and the session can run dry mid-way instead.
        this.total = this.dryFire ? 0 : diff.total;

        this.render();
        if (this.dryFire) {
            setTimeout(() => this.finish(), 700);
        } else {
            this.nextTarget();
        }
    },

    render() {
        const stage = document.getElementById('target-practice-stage');
        if (!stage) return;
        if (this.dryFire) {
            stage.innerHTML = `<p style="color:#aaa; max-width:360px;">No live rounds — you run through your draw and stance instead. Better than nothing, barely.</p>`;
            return;
        }
        stage.innerHTML = `
            <div id="target-practice-progress" style="margin-bottom:8px; color:#ffd700; font-weight:bold;"></div>
            <div id="target-practice-arena" style="position:relative; width:100%; height:150px; background:linear-gradient(to bottom, #4a3420, #1a1005); border:2px solid #555; border-radius:8px; overflow:hidden;"></div>
            <p style="font-size:0.75em; color:#999; margin-top:6px;">🍾🥫 shoot it — 🐦🎩🚩 leave it alone</p>
        `;
        this.updateProgress();
    },

    updateProgress() {
        const el = document.getElementById('target-practice-progress');
        if (el) el.textContent = `${this.index}/${this.total} — ${this.hits} hit${this.hits === 1 ? '' : 's'}, ${wagon.bullets} bullet${wagon.bullets === 1 ? '' : 's'} left`;
    },

    nextTarget() {
        if (this.ended) return;
        this.updateProgress();
        if (this.index >= this.total || wagon.bullets <= 0) { this.finish(); return; }

        const arena = document.getElementById('target-practice-arena');
        if (!arena) return;
        this.isDecoyRound = Math.random() < this.decoyChance;
        const pool = this.isDecoyRound ? this.decoys : this.realTargets;
        const icon = pool[Math.floor(Math.random() * pool.length)];

        // Random position every round — leaves margin so the emoji never
        // clips the arena edges.
        const leftPct = Math.random() * 82;
        const topPct = Math.random() * 62;

        arena.innerHTML = `<div id="target-practice-target" style="position:absolute; left:${leftPct}%; top:${topPct}%; font-size:2.6em; cursor:crosshair; user-select:none;">${icon}</div>`;
        const el = document.getElementById('target-practice-target');
        if (el) el.onclick = (e) => { e.stopPropagation(); this.fire(true); };

        this.timeoutId = setTimeout(() => this.fire(false), this.windowMs);
    },

    fire(wasClicked) {
        clearTimeout(this.timeoutId);
        const el = document.getElementById('target-practice-target');
        if (el) el.onclick = null;

        if (wasClicked) {
            wagon.bullets = Math.max(0, wagon.bullets - 1);
            this.bulletsFired++;
            if (this.isDecoyRound) {
                this.falsePositives++;
                AudioManager.playSound('miss');
            } else {
                this.hits++;
                AudioManager.playSound('rifle');
            }
        } else if (!this.isDecoyRound) {
            // Missed a real target (timed out without a shot) — no bullet
            // spent, but no credit either.
            AudioManager.playSound('miss');
        }
        // Decoy correctly left alone: no sound, no penalty, no bullet spent.

        this.index++;
        this.nextTarget();
    },

    finish() {
        this.ended = true;
        resolveTargetPracticeGame(this.hits, this.falsePositives, this.index, this.bulletsFired, this.dryFire);
    }
};

function startTargetPracticeGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    const ammoNote = wagon.bullets > 0
        ? `You've got ${wagon.bullets} bullet${wagon.bullets === 1 ? '' : 's'} to work with.`
        : "You're out of bullets, though — this'll have to be a dry-fire session.";
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>🎯 Target Practice</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">Bottles and cans pop up somewhere new on the fence rail each time — no animals involved, so this one's fair game even on a Vegetarian Run. But not everything out there is a target: leave the birds, hats, and flags alone, or it costs you same as a miss. ${ammoNote}</p>
            <div id="target-practice-stage" style="min-height:110px; display:flex; flex-direction:column; align-items:center; justify-content:center;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    TargetPracticeGame.start();
}

function resolveTargetPracticeGame(hits, falsePositives, roundsPlayed, bulletsFired, wasDryFire) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;
    if (!wagon.flags) wagon.flags = {};

    const netScore = Math.max(0, hits - falsePositives);
    const accuracy = (!wasDryFire && roundsPlayed > 0) ? netScore / roundsPlayed : 0;

    let msg, subMsg;
    if (wasDryFire) {
        wagon.flags.sharpshooterUntilDay = wagon.days + 1;
        wagon.flags.sharpshooterBonus = 5;
        msg = `No bullets to work with, so it's dry-fire drills instead — draw, aim, click.`;
        subMsg = `A token +5% hunting accuracy for 1 day. Worth restocking on bullets.`;
        AudioManager.playSound('miss');
    } else if (accuracy >= 0.7) {
        const days = 3, bonus = 15;
        wagon.flags.sharpshooterUntilDay = wagon.days + days;
        wagon.flags.sharpshooterBonus = bonus;
        msg = `A hot streak on the fence rail — your eye's in, and it shows.`;
        subMsg = `+${bonus}% hunting accuracy for the next ${days} days (${bulletsFired} bullets fired).`;
        AudioManager.playSound('trade');
        AchievementManager.unlock('dead_aim', 'Dead Aim');
    } else if (accuracy >= 0.35) {
        const days = 2, bonus = 7;
        wagon.flags.sharpshooterUntilDay = wagon.days + days;
        wagon.flags.sharpshooterBonus = bonus;
        msg = `A middling session — some hits, some misses, and at least one shot spent on something that wasn't a bottle.`;
        subMsg = `+${bonus}% hunting accuracy for the next ${days} days (${bulletsFired} bullets fired).`;
        AudioManager.playSound('miss');
    } else {
        msg = falsePositives > hits
            ? `You spend more shots on birds and hats than bottles today. The bottles remain undefeated.`
            : `You miss more than you hit today. The bottles remain undefeated.`;
        subMsg = `No buff (${bulletsFired} bullets spent anyway).`;
        AudioManager.playSound('miss');
    }

    const fullMsg = `${msg} ${subMsg}`;
    updateActionPrompt(translateSanity(fullMsg));
    eventLog.insertAdjacentHTML('afterbegin', `${fullMsg}<br>`);
    textUpdateUI();

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>🎯 Target Practice</h3>
                <p>${translateSanity(msg)}</p>
                <p style="color:#aaa; font-size:0.85em;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

const STORYTELLING_POOLS = {
    CREATURE: ANIMALS.map(a => a.name),
    ITEM: JUNK,
    NAME: NPC_names,
    PLACE: Object.values(Landmarks).map(l => l.name),
    VERB: STORYTELLING_VERBS,
    DEATH: DEATH_CAUSES,
};

const STORY_TEMPLATES = [
    { text: "And that was the day I {0} a {1} using only {2}.", slots: ['VERB', 'CREATURE', 'ITEM'] },
    { text: "Legend has it {0} once {1} a {2} out past the tree line.", slots: ['NAME', 'VERB', 'CREATURE'] },
    { text: "I once traded {0} for a rematch with a {1}, which is how I first met {2}.", slots: ['ITEM', 'CREATURE', 'NAME'] },
    { text: "Somewhere near {0}, a {1} is still telling its side of the story about {2}.", slots: ['PLACE', 'CREATURE', 'NAME'] },
    { text: "It started with {0}, ended with a {1}, and somewhere in between I {2} an entire wagon train.", slots: ['ITEM', 'CREATURE', 'VERB'] },
    { text: "The secret to surviving {0}? {1}, and never turn your back on a {2}.", slots: ['PLACE', 'ITEM', 'CREATURE'] },
    { text: "I heard {0} {1} a {2} and never spoke of it again.", slots: ['NAME', 'VERB', 'CREATURE'] },
    { text: "You haven't lived until the day you {0} a {1} for {2}.", slots: ['VERB', 'CREATURE', 'ITEM'] },
    { text: "The whole camp still talks about the night {0} {1} a {2} and won.", slots: ['NAME', 'VERB', 'CREATURE'] },
    { text: "They warned me I'd end up like the fella whose tombstone says {0} Fine by me — I already {1} a {2}.", slots: ['DEATH', 'VERB', 'CREATURE'] },
    { text: "Never ask {0} why they were spotted near {1} carrying {2}. But you and I know why.", slots: ['NAME', 'PLACE', 'ITEM'] },
    { text: "I knew {0} was trouble the second they tried to trade {1} to an angry {2}.", slots: ['NAME', 'ITEM', 'CREATURE'] },
    { text: "My diary entry from {0}? Just two words: {1} and a furious {2}.", slots: ['PLACE', 'ITEM', 'CREATURE'] },
    { text: "Before I {0} a {1}, the camp doctor swore my cause of death would be '{2}'.", slots: ['VERB', 'CREATURE', 'DEATH'] },
    { text: "The sheriff at {0} arrested {1} for public possession of {2}.", slots: ['PLACE', 'NAME', 'ITEM'] },
    { text: "I spent three whole days at {0} trying to {1} a {2}.", slots: ['PLACE', 'VERB', 'CREATURE'] },
    { text: "If my tombstone ends up reading '{0}', just remember that I {1} a {2} first.", slots: ['DEATH', 'VERB', 'CREATURE'] },
    { text: "We almost made it past {0}, until {1} dropped {2} into the river.", slots: ['PLACE', 'NAME', 'ITEM'] },
    { text: "Rule number one of the trail: never swap {0} with {1} unless a {2} is watching.", slots: ['ITEM', 'NAME', 'CREATURE'] },
    { text: "I was minding my own business near {0} when {1} suddenly hit me with {2}.", slots: ['PLACE', 'NAME', 'ITEM'] },
    { text: "Nothing lifts trail morale quite like the night {0} {1} a {2}.", slots: ['NAME', 'VERB', 'CREATURE'] },
    { text: "I tried to bribe a {0} with {1} near {2}. It went about as well as you'd expect.", slots: ['CREATURE', 'ITEM', 'PLACE'] },
    { text: "The preacher at {0} swore our recent case of '{1}' was punishment for when {2} {3} a {4}.", slots: ['PLACE', 'DEATH', 'NAME', 'VERB', 'CREATURE'] },
    { text: "The last thing {0} yelled before meeting their end was: 'Watch me {1} this {2}!'", slots: ['NAME', 'VERB', 'CREATURE'] },
    { text: "You haven't truly seen chaos until {0} tries to {1} a {2} using {3}.", slots: ['NAME', 'VERB', 'CREATURE', 'ITEM'] },
    { text: "Forget gold! The real prize at {0} was finding {1} buried under a {2}.", slots: ['PLACE', 'ITEM', 'CREATURE'] },
    { text: "I asked {0} for survival advice, and they handed me {1} and pointed toward a {2}.", slots: ['NAME', 'ITEM', 'CREATURE'] },
    { text: "When we made camp at {0}, {1} swore they saw a {2} wearing {3}.", slots: ['PLACE', 'NAME', 'CREATURE', 'ITEM'] },
    { text: "They said '{0}' was a tragic way to go, but personally I blame the {1}.", slots: ['DEATH', 'CREATURE'] },
];

const STORYTELLING_JUDGE_REACTIONS = [
    "A kid starts repeating the punchline immediately. It will be repeated for days.",
    "A round of applause. Someone starts humming a tune to go with it.",
    "As your story finishes, people aren't sure how to react. The oxen then let out a huge fart and everyone laughs. We'll say they are laughing from your story.",
    "Dead silence, then the kind of laugh that turns into a coughing fit.",
    "Even the oxen seem entertained, which is a low bar, but still.",
    "It's not even that good, but everyone's tired enough to find it hilarious.",
    "Someone demands a sequel. There is no sequel. You invent one on the spot. People regret asking for a sequel.",
    "The whole camp loses it. Someone snorts stew out their nose and then slurps it back up. Stew is a precious commodity on the trail.",
];

const StorytellingGame = {
    template: null,
    picks: [],
    slotIndex: 0,
    cardsPerSlot: 4,
    ended: false,
    _currentOptions: [],

    start() {
        this.ended = false;
        this.picks = [];
        this.slotIndex = 0;
        this.template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];
        this.render();
        this.nextSlot();
    },

    render() {
        const stage = document.getElementById('storytelling-stage');
        if (!stage) return;
        stage.innerHTML = `
            <p id="storytelling-preview" style="font-size:1.05em; min-height:64px; color:#eee; font-style:italic;"></p>
            <div id="storytelling-cards" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:10px;"></div>
        `;
        this.updatePreview();
    },

    updatePreview() {
        const el = document.getElementById('storytelling-preview');
        if (!el) return;
        let text = this.template.text;
        this.template.slots.forEach((slotType, i) => {
            const filled = this.picks[i];
            text = text.replace(`{${i}}`, filled
                ? `<strong style="color:#ffd700;">${filled}</strong>`
                : `<span style="color:#888;">____</span>`);
        });
        el.innerHTML = text;
    },

    nextSlot() {
        if (this.ended) return;
        if (this.slotIndex >= this.template.slots.length) { this.finish(); return; }
        const slotType = this.template.slots[this.slotIndex];
        const pool = STORYTELLING_POOLS[slotType] || JUNK;

        const options = [];
        const usedIdx = new Set();
        while (options.length < this.cardsPerSlot && options.length < pool.length) {
            const idx = Math.floor(Math.random() * pool.length);
            if (usedIdx.has(idx)) continue;
            usedIdx.add(idx);
            options.push(pool[idx]);
        }
        this._currentOptions = options;

        const cardsEl = document.getElementById('storytelling-cards');
        if (cardsEl) {
            cardsEl.innerHTML = options.map((opt, i) =>
                `<button class="btn btn-info" style="max-width:220px; white-space:normal; font-size:0.8em;" onclick="StorytellingGame.pick(${i})">${opt}</button>`
            ).join('');
        }
    },

    pick(i) {
        if (this.ended) return;
        const word = this._currentOptions[i];
        if (word === undefined) return;
        this.picks[this.slotIndex] = word;
        AudioManager.playSound('key');
        this.slotIndex++;
        this.updatePreview();
        this.nextSlot();
    },

    finish() {
        this.ended = true;
        let finalStory = this.template.text;
        this.template.slots.forEach((slotType, i) => {
            finalStory = finalStory.replace(`{${i}}`, this.picks[i]);
        });
        resolveStorytellingGame(finalStory);
    }
};

function startStorytellingGame() {
    const content = modalChild;
    if (!content || !wagon) return;
    content.innerHTML = `
        <div style="text-align:center; padding:16px; background:#1a1005; color:#eee;">
            <h3>📖 Storytelling</h3>
            <p style="font-size:0.85em; max-width:440px; margin:0 auto 10px;">The fire's going, the family's tired of walking, and somebody has to tell a lie big enough to make the day worth it. Pick a card for each blank — there's no wrong answer, just the funniest one.</p>
            <div id="storytelling-stage" style="max-width:460px; margin:0 auto;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    StorytellingGame.start();
}

function resolveStorytellingGame(finalStory) {
    if (!wagon) return;
    wagon.spendPreparationDay();
    if (wagon.characters.every(c => c.status === "Dead")) return;

    const aliveCount = wagon.characters.filter(c => c.status !== "Dead").length;
    let sanityGain = 12 + aliveCount;
    const hasStorytellerBonus = wagon.professionName === "Teacher" || wagon.professionName === "Gamer";
    if (hasStorytellerBonus) sanityGain += 8;
    const hasBook = wagon.books > 0;
    if (hasBook) sanityGain += 5;

    wagon.sanity = Math.min(100, wagon.sanity + sanityGain);

    const reaction = STORYTELLING_JUDGE_REACTIONS[Math.floor(Math.random() * STORYTELLING_JUDGE_REACTIONS.length)];
    const bonusBits = [
        hasStorytellerBonus ? "a natural storyteller" : null,
        hasBook ? "a book's worth of material to steal from" : null,
    ].filter(Boolean).join(" and ");

    const msg = `"${finalStory}" ${reaction}`;
    const subMsg = `+${sanityGain} sanity${bonusBits ? ` (helped by ${bonusBits})` : ''}.`;

    AudioManager.playSound('yummy');
    updateActionPrompt(translateSanity(`${msg} ${subMsg}`));
    eventLog.insertAdjacentHTML('afterbegin', `${msg} ${subMsg}<br>`);
    textUpdateUI();
    AchievementManager.unlock('campfire_raconteur', 'Campfire Raconteur');

    const content = modalChild;
    if (content) {
        content.innerHTML = `
            <div style="text-align:center; padding:24px;">
                <h3>📖 Storytelling</h3>
                <p style="font-style:italic; color:#ffd700;">"${finalStory}"</p>
                <p style="color:#ccc;">${reaction}</p>
                <p style="color:#8fd694; font-weight:bold;">${subMsg}</p>
                <div class="buttons"><button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="Back to it.">Continue</button></div>
            </div>
        `;
    }
}

function startGathering() {
    if (DEBUG) console.log('startGathering');
	endMuncherGame(true); // clean up any abandoned Number Muncher session
	const zone = wagon.currentZone;
	AudioManager.playGatheringBGM();
    
    // Determine Zone Probabilities
    let gatherChance = 1.0; // Zones 1 & 2 default 100%
    
    if (zone === 3 || zone === 5) {
        gatherChance = 0.85;
    } else if (zone === 4) {
        gatherChance = 0.50;
    }

    if (hasSkill("Gathering")) {
        gatherChance = Math.min(1.0, gatherChance + 0.25);
    }

    // Weather works the opposite way it does for hunting: snow reveals tracks (good for tracking), but it BURIES the wood and plants you're actually looking for here. Rain makes things a bit harder too, just less severely.
    if (wagon.isSnowing) {
        gatherChance -= 0.20;
    } else if (wagon.hasWater) {
        gatherChance -= 0.10;
    }
    gatherChance = Math.max(0.05, gatherChance * (wagon.diffMultiplier || 1.0));

    // Success Roll
    const roll = Math.random();
    if (roll > gatherChance) {
        const barrenMsg = translateSanity("The landscape around you is too barren to find useful resources at the moment.");
        updateCraftingMessage(barrenMsg);
        return;
    }

    // Zone flavor: what you find first (and how much of it) depends on the actual terrain instead of every zone running the identical Wood -> Cow -> Plants -> Stone sequence.
    const profile = ZONE_GATHER_PROFILE[zone] || ZONE_GATHER_PROFILE[1];
    const stageOrder = profile.order.slice();
    const firstResource = stageOrder[0];

    // Initialize Gathering State
    wagon.gatheringState = {
        stageIndex: 0,
        stageOrder: stageOrder,
        yieldMult: profile.yieldMult,
        stage: GATHER_RESOURCE_INFO[firstResource].stageName,
        clicks: 0,
        required: computeGatherRequiredClicks(firstResource),
        critCount: 0,
        sessionGains: {},
        isProcessing: false
    };
    
    updateCraftingMessage(translateSanity(profile.intro));
    renderGatheringUI();
}

function renderGatheringUI() {
    const s = wagon.gatheringState;
    const content = modalChild;

    let actionText = s.stage;
    if (wagon.sanity < 30) {
        const gibberish = ["Fist the Flora", "Digital Deforestation", "Knock on Wood?", "ERROR: 0xPUNCH"];
        actionText = gibberish[Math.floor(Math.random() * gibberish.length)];
    }

    content.innerHTML = `
        <div class="gathering-container" style="background: #333; color: #fff; padding: 20px; border: 4px solid #555; font-family: 'Londrina Solid', sans-serif; text-align: center; position: relative;">
            
            <div id="mini-game-msg-area" style="margin-bottom: 15px; background: rgba(0,0,0,0.5); color: #ffff00; border: 1px solid #ffff00; padding: 8px; font-family: 'Courier New'; font-size: 1.2cqw; min-height: 1.5em;">
                GATHERING MODE: ${actionText}
            </div>

            <p style="font-size:0.75em; color:#aaa; margin: 4px 0;">Stage ${s.stageIndex + 1} of ${s.stageOrder.length}</p>

            <div id="gather-visual" style="margin: 20px 0;">
                <img src="./img/gather/${s.stage.replace(/ /g, '_')}.png" style="width: 32vw; image-rendering: pixelated; border: 2px solid #fff;">
            </div>
            
            <p id="gather-click-count">Clicks: ${s.clicks} / ${s.required}</p>
            <div class="progress" style="background: #555; height: 20px; width: 80%; margin: 10px auto;">
                <div id="gather-bar" style="background: #00A000; height: 100%; width: ${(s.clicks/s.required)*100}%; transition: width 0.1s;"></div>
            </div>
            <div class="buttons">
                <button ${actionAttrs('punchGather')} class="btn btn-success" style="padding: 20px; font-size: 1.5em;">PUNCH!</button>
            </div>
            <div class="buttons" style="margin-top: 8px;">
                <button ${actionAttrs('abandonGathering')} class="btn btn-warning" style="font-size: 0.8em;" title="Bank whatever you've already gathered and call it a day.">Stop For Today</button>
            </div>
        </div>
    `;
	if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function abandonGathering() {
    const s = wagon.gatheringState;
    if (!s) return;
    // Resources from completed stages are already in wagon.resources —
    // nothing to lose there, only the in-progress stage is forfeited.
    const tally = Object.entries(s.sessionGains || {}).map(([k, v]) => `${Math.round(v)} ${k}`).join(', ');
    wagon.gatheringState = null;
    if (document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    const msg = tally
        ? `You call it a day and head back to the wagon. Today's haul: ${tally}.`
        : `You call it a day before finding anything worth keeping.`;
    updateActionPrompt(translateSanity(msg));
    eventLog.insertAdjacentHTML('afterbegin', `${msg}<br>`);
    textUpdateUI();
}

function punchGather() {
    const s = wagon.gatheringState;
    if (!s || s.isProcessing) return;

    s.clicks++;
    
    // Direct DOM Updates (Prevents wiping the feedback text)
    const bar = document.getElementById('gather-bar');
    if (bar) bar.style.width = `${(s.clicks / s.required) * 100}%`;
    
    const clickText = document.getElementById('gather-click-count');
    if (clickText) clickText.textContent = `Clicks: ${s.clicks} / ${s.required}`;

    // Visual Shake
    const visual = document.getElementById('gather-visual');
    if (visual) {
        visual.style.transform = `scale(1.1) rotate(${Math.random() * 20 - 10}deg)`;
        setTimeout(() => visual.style.transform = 'scale(1) rotate(0deg)', 100);
    }

    // Logic & Messaging
    let isCrit = (Math.random() < 0.10);
    if (isCrit) {
        s.clicks += 2;
        s.critCount = (s.critCount || 0) + 1;
        updateCraftingMessage(translateSanity("CRITICAL PUNCH! You found a speed-run exploit!"));
    } else if (s.clicks % 3 === 0) {
        const punchMsgs = [
            "You PUNCH to gather. Your knuckles are screaming.",
            "You PUNCH to gather. The wood splinters into 8-bit shards.",
            "You PUNCH to gather. Physics is a suggestion at this point."
        ];
        const msg = punchMsgs[Math.floor(Math.random() * punchMsgs.length)];
        updateCraftingMessage(translateSanity(msg));
    }

    // Stage Resolution
    if (s.clicks >= s.required) {
        resolveGatheringStage();
    }
}

const MUNCHER_RULES = [
    { label: "MULTIPLES OF 2", test: n => n % 2 === 0, make: () => 2 * (Math.floor(Math.random() * 15) + 1), pool: () => Math.floor(Math.random() * 30) + 1 },
    { label: "MULTIPLES OF 3", test: n => n % 3 === 0, make: () => 3 * (Math.floor(Math.random() * 10) + 1), pool: () => Math.floor(Math.random() * 30) + 1 },
    { label: "MULTIPLES OF 5", test: n => n % 5 === 0, make: () => 5 * (Math.floor(Math.random() * 8) + 1), pool: () => Math.floor(Math.random() * 40) + 1 },
    { label: "PRIMES", test: n => [2,3,5,7,11,13,17,19,23,29,31,37].includes(n), make: () => [2,3,5,7,11,13,17,19,23,29,31,37][Math.floor(Math.random() * 12)], pool: () => Math.floor(Math.random() * 39) + 2 },
    { label: "ODD NUMBERS", test: n => n % 2 === 1, make: () => 2 * Math.floor(Math.random() * 15) + 1, pool: () => Math.floor(Math.random() * 30) + 1 },
    { label: "FACTORS OF 12", test: n => 12 % n === 0, make: () => [1,2,3,4,6,12][Math.floor(Math.random() * 6)], pool: () => Math.floor(Math.random() * 15) + 1 },
    { label: "FACTORS OF 24", test: n => 24 % n === 0, make: () => [1,2,3,4,6,8,12,24][Math.floor(Math.random() * 8)], pool: () => Math.floor(Math.random() * 26) + 1 },
];

const MUNCHER_COLS = 5;
const MUNCHER_ROWS = 4;

function startMuncherChallenge(config) {
    endMuncherGame(true); // clear any abandoned session first

    const rule = MUNCHER_RULES[Math.floor(Math.random() * MUNCHER_RULES.length)];
    const isHard = (wagon.diffMultiplier || 1.0) < 1.0;
    const isEasy = (wagon.diffMultiplier || 1.0) > 1.0;

    // Build the board, then force the correct-answer count into a playable band:
    // at least 6 (a real hunt) and at most 12 (wrong answers must exist to punish).
    const board = [];
    for (let i = 0; i < MUNCHER_COLS * MUNCHER_ROWS; i++) {
        const value = rule.pool();
        board.push({ value, eaten: false });
    }
    const countCorrect = () => board.filter(c => !c.eaten && rule.test(c.value)).length;
    let guard = 0;
    while (countCorrect() < 6 && guard++ < 200) {
        const wrongCells = board.filter(c => !rule.test(c.value));
        if (!wrongCells.length) break;
        wrongCells[Math.floor(Math.random() * wrongCells.length)].value = rule.make();
    }
    guard = 0;
    while (countCorrect() > 12 && guard++ < 200) {
        const rightCells = board.filter(c => rule.test(c.value));
        let w = rule.pool(), tries = 0;
        while (rule.test(w) && tries++ < 50) w = rule.pool();
        if (rule.test(w)) break;
        rightCells[Math.floor(Math.random() * rightCells.length)].value = w;
    }

    const randomTroggleSprite = () => 1 + Math.floor(Math.random() * 5); // 5 variants provided: troggle1-5.png
    const troggles = [{ x: MUNCHER_COLS - 1, y: MUNCHER_ROWS - 1, sprite: randomTroggleSprite() }];
    if (isHard) troggles.push({ x: MUNCHER_COLS - 1, y: 0, sprite: randomTroggleSprite() });

    muncherState = {
        rule, board, troggles,
        muncher: { x: 0, y: 0 },
        lives: (wagon.professionName === "Gamer") ? 4 : 3, // Gamers get an extra continue
        targets: countCorrect(),
        status: "Munch every correct number. Avoid the Troggles.",
        over: false,
        onWin: config.onWin,
        onLose: config.onLose,
        title: config.title || "NUMBER MUNCHER",
        subtitle: config.subtitle || "",
        interval: null,
        keyHandler: null,
    };

    // Keyboard: discrete steps on keydown (the global held-key object suits the realtime loops, not grid movement). preventDefault stops arrow/space scrolling.
    muncherState.keyHandler = (e) => {
        if (!muncherState || muncherState.over) return;
        const k = e.key;
        if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Enter","w","a","s","d","W","A","S","D"].includes(k)) e.preventDefault();
        if (k === "ArrowUp" || k === "w" || k === "W") moveMuncher(0, -1);
        else if (k === "ArrowDown" || k === "s" || k === "S") moveMuncher(0, 1);
        else if (k === "ArrowLeft" || k === "a" || k === "A") moveMuncher(-1, 0);
        else if (k === "ArrowRight" || k === "d" || k === "D") moveMuncher(1, 0);
        else if (k === " " || k === "Enter") munchCell();
    };
    document.addEventListener('keydown', muncherState.keyHandler);

    // Troggle patrol clock: faster + more of them on Hard, slower on Easy
    const tickMs = isHard ? 700 : (isEasy ? 1000 : 850);
    muncherState.interval = setInterval(muncherTroggleTick, tickMs);

    renderMuncherBoard();
}

function moveMuncher(dx, dy) {
    const s = muncherState;
    if (!s || s.over) return;
    const nx = Math.max(0, Math.min(MUNCHER_COLS - 1, s.muncher.x + dx));
    const ny = Math.max(0, Math.min(MUNCHER_ROWS - 1, s.muncher.y + dy));
    s.muncher.x = nx; s.muncher.y = ny;
    // Walking into a Troggle is just as fatal as being caught
    if (s.troggles.some(t => t.x === nx && t.y === ny)) {
        muncherLoseLife("You walked INTO the Troggle. Bold strategy.");
        return;
    }
    renderMuncherBoard();
}

function munchCell() {
    const s = muncherState;
    if (!s || s.over) return;
    const idx = s.muncher.y * MUNCHER_COLS + s.muncher.x;
    const cell = s.board[idx];
    if (cell.eaten) { return; } // already-empty square: harmless chomp of air
    if (s.rule.test(cell.value)) {
        cell.eaten = true;
        s.targets--;
        AudioManager.playSound('meat');
        if (s.targets <= 0) { endMuncherGame(false, true); return; }
        s.status = `CHOMP. ${s.targets} left.`;
    } else {
        muncherLoseLife(`${cell.value} is NOT ${s.rule.label.toLowerCase()}. The Troggles heard that mistake.`);
        return;
    }
    renderMuncherBoard();
}

function muncherTroggleTick() {
    const s = muncherState;
    if (!s || s.over) return;
    // Board gone (modal replaced from outside)? Clean up silently — boss-laser lesson.
    if (!document.getElementById('muncher-board')) { endMuncherGame(true); return; }

    s.troggles.forEach(t => {
        // 60% chase, 40% shamble randomly (Troggles are menacing, not smart)
        if (Math.random() < 0.6) {
            const dx = s.muncher.x - t.x;
            const dy = s.muncher.y - t.y;
            if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) t.x += Math.sign(dx);
            else if (dy !== 0) t.y += Math.sign(dy);
        } else {
            const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
            const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
            t.x = Math.max(0, Math.min(MUNCHER_COLS - 1, t.x + dx));
            t.y = Math.max(0, Math.min(MUNCHER_ROWS - 1, t.y + dy));
        }
    });

    if (s.troggles.some(t => t.x === s.muncher.x && t.y === s.muncher.y)) {
        muncherLoseLife("A Troggle caught you mid-calculation!");
        return;
    }
    renderMuncherBoard();
}

function muncherLoseLife(reason) {
    const s = muncherState;
    if (!s || s.over) return;
    s.lives--;
    AudioManager.playSound('miss');
    if (s.lives <= 0) { endMuncherGame(false, false); return; }
    s.status = `${reason} (${s.lives} ${s.lives === 1 ? 'life' : 'lives'} left)`;
    // Respawn: muncher to top-left, Troggles pushed back to far corners
    s.muncher = { x: 0, y: 0 };
    s.troggles.forEach((t, i) => { t.x = MUNCHER_COLS - 1; t.y = (i === 0) ? MUNCHER_ROWS - 1 : 0; });
    renderMuncherBoard();
}

function renderMuncherBoard() {
    const s = muncherState;
    if (!s) return;
    const content = modalChild;
    if (!content) return;

    const hearts = '\u2665'.repeat(s.lives);
    const cells = s.board.map((cell, idx) => {
        const x = idx % MUNCHER_COLS, y = Math.floor(idx / MUNCHER_COLS);
        const isMuncher = (s.muncher.x === x && s.muncher.y === y);
        const troggleHere = s.troggles.find(t => t.x === x && t.y === y);

        let bg = '#001a00', fg = '#00A000', inner;
        if (troggleHere) {
            bg = '#4B0082'; fg = '#FF66FF';
            inner = `<img src="./img/gather/troggle${troggleHere.sprite}.png" alt="Troggle" style="width:80%; height:80%; object-fit:contain; image-rendering:pixelated;" onerror="this.style.opacity=0;">`;
        } else if (isMuncher) {
            bg = '#00A000'; fg = '#000';
            const valueBadge = cell.eaten ? '' : `<span style="position:absolute; bottom:2px; right:4px; font-size:0.65em; font-weight:bold; color:#000; background:rgba(255,255,255,0.8); border-radius:3px; padding:0 3px; line-height:1.3;">${cell.value}</span>`;
            inner = `<img src="./img/gather/muncher.png" alt="Muncher" style="width:80%; height:80%; object-fit:contain; image-rendering:pixelated;" onerror="this.style.opacity=0;">${valueBadge}`;
        } else {
            inner = cell.eaten ? '' : cell.value;
        }
        return `<div data-cell="${idx}" style="position:relative; display:flex; align-items:center; justify-content:center; aspect-ratio: 1.4; border:1px solid #00A000; background:${bg}; color:${fg}; font-size:1.1em; font-weight:bold; cursor:pointer; user-select:none; overflow:hidden;">${inner}</div>`;
    }).join('');

    content.innerHTML = `
        <div style="text-align:center; background:#000; color:#00A000; padding:15px; border:4px solid #00A000; font-family:'Courier New';">
            <h3 style="margin:0;">${s.title}</h3>
            ${s.subtitle ? `<p style="margin:4px 0; font-size:0.85em;">${s.subtitle}</p>` : ''}
            <p style="margin:6px 0; font-size:1.1em; letter-spacing:1px;">EAT: <strong>${s.rule.label}</strong> &nbsp;|&nbsp; <span style="color:#FF4444;">${hearts}</span> &nbsp;|&nbsp; LEFT: ${s.targets}</p>
            <div id="muncher-board" style="display:grid; grid-template-columns: repeat(${MUNCHER_COLS}, 1fr); gap:4px; margin:8px 0;">
                ${cells}
            </div>
            <p style="min-height:2.4em; font-size:0.85em; color:#7CFC00; margin:6px 0;">${s.status}</p>
            <p style="font-size:0.7em; color:#666; margin:0;">MOVE: Arrows/WASD or tap a neighboring square &nbsp;\u00B7&nbsp; MUNCH: Space/Enter or tap your own square</p>
        </div>
    `;

    // Tap controls: one delegated handler per render (innerHTML wipes the old one)
    const boardEl = document.getElementById('muncher-board');
    if (boardEl) {
        boardEl.onclick = (e) => {
            const el = e.target.closest('[data-cell]');
            if (!el || !muncherState || muncherState.over) return;
            const idx = Number(el.dataset.cell);
            const x = idx % MUNCHER_COLS, y = Math.floor(idx / MUNCHER_COLS);
            const mdx = x - muncherState.muncher.x, mdy = y - muncherState.muncher.y;
            if (mdx === 0 && mdy === 0) munchCell();
            else if (Math.abs(mdx) + Math.abs(mdy) === 1) moveMuncher(mdx, mdy);
        };
    }
}

// silent=true: cleanup only (abandoned game). Otherwise renders the win/lose
// screen whose Continue button hands off to the stored onWin/onLose callback.
function endMuncherGame(silent, won) {
    const s = muncherState;
    if (!s) return;
    s.over = true;
    if (s.interval) clearInterval(s.interval);
    if (s.keyHandler) document.removeEventListener('keydown', s.keyHandler);
    muncherState = null;
    if (silent) return;

    const content = modalChild;
    if (!content) { if (won && s.onWin) s.onWin(); else if (!won && s.onLose) s.onLose(); return; }

    if (won) {
        AudioManager.playSound('achievement');
        content.innerHTML = `
            <div style="text-align:center; background:#000; color:#00A000; padding:20px; border:4px solid #00A000; font-family:'Courier New';">
                <h3>BOARD CLEARED!</h3>
                <p>The Troggles slink away, humiliated by your superior arithmetic. Somewhere, a 1990s computer lab teacher sheds a proud tear.</p>
                <button id="muncher-continue-btn" class="btn btn-success" title="Nom nom. Press on.">CONTINUE</button>
            </div>
        `;
        const btn = document.getElementById('muncher-continue-btn');
        if (btn) btn.onclick = () => { if (s.onWin) s.onWin(); };
    } else {
        AudioManager.playSound('gameover');
        content.innerHTML = `
            <div style="text-align:center; background:#000; color:#FF4444; padding:20px; border:4px solid #FF4444; font-family:'Courier New';">
                <h3>MUNCHED.</h3>
                <p>The Troggles have eaten your muncher, your logic, and your pride, in that order.</p>
                <button id="muncher-lose-btn" class="btn btn-danger" title="The troggle has made its choice. And it was hunger.">ACCEPT DEFEAT</button>
            </div>
        `;
        const btn = document.getElementById('muncher-lose-btn');
        if (btn) btn.onclick = () => { if (s.onLose) s.onLose(); };
    }
}

let packingState = null;

const PACKING_COLS = 8;
const PACKING_ROWS = 5;

// Category → shape/color. Shapes are normalized [x,y] cell lists. fullName
// is used for the hover tooltip on each tray chip — the 4-letter label
// alone ("WOOD", "H2O") wasn't recognizable as "Firewood bundle"/"Water
// barrel" at a glance.
const PACKING_CATS = {
    FOOD:    { label: 'FOOD',  fullName: 'Food sacks',            color: '#C88A3D', cells: [[0,0],[1,0],[0,1],[1,1]] },  // 2×2 sack
    WATER:   { label: 'H2O',   fullName: 'Water barrel',          color: '#1E6FB8', cells: [[0,0],[0,1]] },              // 1×2 barrel
    WOOD:    { label: 'WOOD',  fullName: 'Firewood bundle',       color: '#8B5A2B', cells: [[0,0],[1,0],[2,0]] },        // 3×1 bundle
    AMMO:    { label: 'AMMO',  fullName: 'Bullet crate',          color: '#5A5A5A', cells: [[0,0]] },                    // 1×1 box
    PARTS:   { label: 'PART',  fullName: 'Spare wagon parts',     color: '#A0522D', cells: [[0,0],[0,1],[1,1]] },        // L tromino
    CLOTHES: { label: 'CLTH',  fullName: 'Clothing bale',         color: '#7B4FA0', cells: [[0,0],[1,0]] },              // 2×1 bale
    MEDS:    { label: 'MEDS',  fullName: 'Medicine kit',          color: '#2E7D32', cells: [[0,0]] },                    // 1×1 kit
    BOOKS:   { label: 'BOOK',  fullName: 'Book stack',            color: '#1A6B5A', cells: [[0,0],[0,1]] },              // 1×2 stack
    JUNK:    { label: 'JUNK',  fullName: 'Junk (awkward shape)',  color: '#B03060', cells: [[1,0],[2,0],[0,1],[1,1]] },  // S — junk is awkward
    BEANS:   { label: 'BEAN',  fullName: 'Loose filler',          color: '#C8A23D', cells: [[0,0]] },                    // 1×1 loose filler
};

// Renders a piece's actual cell pattern as a small grid — not just its
// bounding-box dimensions, which told the player nothing about whether a
// "JUNK 2×2" was a solid square or (as it actually is) an S-shape with two
// empty corners. Used for both the compact tray chips and the larger
// "currently selected" preview, so the same real shape is visible whether
// you're choosing a piece or about to place it.
function renderPackingShapeGrid(cells, color, cellPx = 12, gap = 1) {
    const w = Math.max(...cells.map(c => c[0])) + 1;
    const h = Math.max(...cells.map(c => c[1])) + 1;
    const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
    let html = `<div style="display:inline-grid; grid-template-columns: repeat(${w}, ${cellPx}px); grid-template-rows: repeat(${h}, ${cellPx}px); gap:${gap}px;">`;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const isFilled = filled.has(`${x},${y}`);
            html += `<div style="width:${cellPx}px; height:${cellPx}px; background:${isFilled ? color : 'transparent'}; border-radius:2px; ${isFilled ? 'box-shadow: inset 0 0 0 1px rgba(0,0,0,0.5);' : ''}"></div>`;
        }
    }
    html += `</div>`;
    return html;
}

// Turn the wagon's real cargo into a piece manifest, then clamp the total area
// into a solvable-but-tense band (24–36 cells on a 40-cell board).
function buildPackingPieces() {
    const specs = [];
    const add = (cat, count) => { for (let i = 0; i < count; i++) specs.push(cat); };
    add('FOOD',    Math.min(3, Math.ceil((wagon.food || 0) / 400)));
    add('WATER',   Math.min(3, wagon.waterBarrels || 0));
    add('WOOD',    Math.min(2, Math.ceil((wagon.firewood || 0) / 20)));
    add('AMMO',    Math.min(2, Math.ceil((wagon.bullets || 0) / 150)));
    add('PARTS',   Math.min(2, Math.ceil(((wagon.wheels || 0) + (wagon.axles || 0) + (wagon.tongues || 0)) / 3)));
    add('CLOTHES', Math.min(2, Math.ceil((wagon.clothing || 0) / 4)));
    add('MEDS',    Math.min(1, Math.ceil((wagon.medicine || 0) / 8)));
    add('BOOKS',   Math.min(1, Math.ceil((wagon.books || 0) / 6)));
    add('JUNK',    Math.min(2, Math.ceil((wagon.junk || 0) / 2)));

    const area = (list) => list.reduce((sum, cat) => sum + PACKING_CATS[cat].cells.length, 0);
    while (area(specs) < 24) specs.push('BEANS'); // pad small hauls with loose beans
    while (area(specs) > 36 && specs.length > 1) {
        // trim the largest piece — "the rest gets strapped on precariously"
        specs.sort((a, b) => PACKING_CATS[b].cells.length - PACKING_CATS[a].cells.length);
        specs.shift();
    }

    return specs.map((cat, i) => ({
        id: i,
        cat,
        label: PACKING_CATS[cat].label,
        fullName: PACKING_CATS[cat].fullName,
        color: PACKING_CATS[cat].color,
        cells: PACKING_CATS[cat].cells.map(c => [...c]), // current (possibly rotated) shape
        placed: false,
        anchor: null,
    }));
}

// Rotate a normalized shape 90° clockwise and re-normalize to the origin.
function rotateShape(cells) {
    const maxY = Math.max(...cells.map(c => c[1]));
    const rotated = cells.map(([x, y]) => [maxY - y, x]);
    const minX = Math.min(...rotated.map(c => c[0]));
    const minY = Math.min(...rotated.map(c => c[1]));
    return rotated.map(([x, y]) => [x - minX, y - minY]);
}

function startPackingGame(config) {
    endPackingGame(true); // clear any abandoned session

    const pieces = buildPackingPieces();
    // Timer scales with difficulty; Gamers get a flat bonus on top because
    // they love inventory management.
    const packTimes = { "Easy": 75, "Normal": 60, "Hard": 45, "New Game+": 35 };
    let packTime = packTimes[wagon.difficulty] || 60;
    if (wagon.professionName === "Gamer") packTime += 15;
    packingState = {
        pieces,
        board: new Array(PACKING_COLS * PACKING_ROWS).fill(null), // pieceId or null
        selected: null,
        totalArea: pieces.reduce((s, p) => s + p.cells.length, 0),
        timeLeft: packTime,
        status: "Select a piece, rotate if needed, tap a square to place its top-left corner.",
        over: false,
        onDone: config.onDone,
        interval: null,
        keyHandler: null,
    };

    packingState.keyHandler = (e) => {
        if (!packingState || packingState.over) return;
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotateSelectedPiece(); }
    };
    document.addEventListener('keydown', packingState.keyHandler);

    packingState.interval = setInterval(() => {
        const s = packingState;
        if (!s || s.over) return;
        if (!document.getElementById('packing-board')) { endPackingGame(true); return; } // modal replaced
        s.timeLeft--;
        const timerEl = document.getElementById('packing-timer');
        if (timerEl) timerEl.textContent = `${s.timeLeft}s`;
        if (s.timeLeft <= 0) scorePackingGame();
    }, 1000);

    renderPackingBoard();
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function rotateSelectedPiece() {
    const s = packingState;
    if (!s || s.over || s.selected === null) return;
    const piece = s.pieces[s.selected];
    if (piece.placed) return;
    piece.cells = rotateShape(piece.cells);
    renderPackingBoard();
}

function tryPlacePiece(pieceId, anchorX, anchorY) {
    const s = packingState;
    const piece = s.pieces[pieceId];
    // bounds + collision check
    for (const [dx, dy] of piece.cells) {
        const x = anchorX + dx, y = anchorY + dy;
        if (x < 0 || x >= PACKING_COLS || y < 0 || y >= PACKING_ROWS) return false;
        if (s.board[y * PACKING_COLS + x] !== null) return false;
    }
    for (const [dx, dy] of piece.cells) {
        s.board[(anchorY + dy) * PACKING_COLS + (anchorX + dx)] = pieceId;
    }
    piece.placed = true;
    piece.anchor = { x: anchorX, y: anchorY };
    return true;
}

function removePiece(pieceId) {
    const s = packingState;
    const piece = s.pieces[pieceId];
    s.board = s.board.map(v => (v === pieceId ? null : v));
    piece.placed = false;
    piece.anchor = null;
}

function handlePackingBoardTap(idx) {
    const s = packingState;
    if (!s || s.over) return;
    const x = idx % PACKING_COLS, y = Math.floor(idx / PACKING_COLS);
    const occupant = s.board[idx];
    if (occupant !== null) {
        // tap a placed piece → pick it back up (and select it)
        removePiece(occupant);
        s.selected = occupant;
        s.status = `${s.pieces[occupant].label} picked back up.`;
    } else if (s.selected !== null && !s.pieces[s.selected].placed) {
        if (tryPlacePiece(s.selected, x, y)) {
            s.status = `${s.pieces[s.selected].label} packed. ${s.pieces.filter(p => !p.placed).length} pieces left.`;
            // auto-advance selection to the next unplaced piece
            const next = s.pieces.find(p => !p.placed);
            s.selected = next ? next.id : null;
        } else {
            s.status = `That doesn't fit there. Rotate (R) or find a bigger gap.`;
        }
    } else {
        s.status = `Select a piece from the tray first.`;
    }
    renderPackingBoard();
}

function renderPackingBoard() {
    const s = packingState;
    if (!s) return;
    const content = modalChild;
    if (!content) return;

    const cellSpans = s.board.map((occ, idx) => {
        let bg = '#2b1d0e', border = '#6b4a2b', text = '';
        if (occ !== null) {
            const piece = s.pieces[occ];
            bg = piece.color; border = '#000';
            if (piece.anchor && (piece.anchor.y * PACKING_COLS + piece.anchor.x) === idx) text = piece.label;
        }
        return `<div data-pcell="${idx}" style="display:flex; align-items:center; justify-content:center; aspect-ratio:1.2; background:${bg}; border:1px solid ${border}; color:#fff; font-size:0.55em; font-weight:bold; cursor:pointer; user-select:none; overflow:hidden;">${text}</div>`;
    }).join('');

    // Each chip now shows the piece's REAL cell pattern, not just its
    // bounding-box dimensions — "JUNK 2×2" told you nothing about whether
    // that was a solid square or (as it actually is) an S-shape with two
    // empty corners. title= gives the full name on hover, since the
    // 4-letter labels ("WOOD", "H2O") aren't obviously "Firewood bundle"/
    // "Water barrel" at a glance.
    const trayChips = s.pieces.filter(p => !p.placed).map(p => {
        const w = Math.max(...p.cells.map(c => c[0])) + 1;
        const h = Math.max(...p.cells.map(c => c[1])) + 1;
        const sel = (s.selected === p.id);
        return `<button data-ptray="${p.id}" title="${p.fullName} (${w}×${h})" style="display:flex; flex-direction:column; align-items:center; gap:3px; background:#241a0e; border:${sel ? '3px solid #FFD700' : '1px solid #6b4a2b'}; padding:5px; cursor:pointer;">
            ${renderPackingShapeGrid(p.cells, p.color, 9, 1)}
            <span style="color:#fff; font-size:0.68em; font-weight:bold;">${p.label} ${w}×${h}</span>
        </button>`;
    }).join(' ');

    // A clear, larger preview of whatever's currently selected — the same
    // shape shown in the tray chip, just big enough to actually plan a
    // placement around, and it re-renders on rotation so the new
    // orientation is immediately visible, not just implied by an updated
    // width×height number.
    const selectedPiece = s.selected !== null ? s.pieces[s.selected] : null;
    const selectedPreview = selectedPiece
        ? (() => {
            const w = Math.max(...selectedPiece.cells.map(c => c[0])) + 1;
            const h = Math.max(...selectedPiece.cells.map(c => c[1])) + 1;
            return `
                <div style="display:flex; align-items:center; justify-content:center; gap:14px; background:#241a0e; border:2px solid #FFD700; border-radius:6px; padding:8px 14px; margin:8px auto; max-width:360px;">
                    ${renderPackingShapeGrid(selectedPiece.cells, selectedPiece.color, 22, 2)}
                    <div style="text-align:left;">
                        <div style="color:#FFD700; font-weight:bold; font-size:0.95em;">${selectedPiece.fullName}</div>
                        <div style="color:#c8b58f; font-size:0.78em;">${w}×${h} footprint &mdash; tap the bed to place its top-left corner, or ROTATE (R) to spin it.</div>
                    </div>
                </div>`;
        })()
        : `<div style="color:#7a6a4f; font-size:0.8em; margin:8px 0;">Select a piece from the tray below to preview its shape here.</div>`;

    const placedArea = s.pieces.filter(p => p.placed).reduce((sum, p) => sum + p.cells.length, 0);

    content.innerHTML = `
        <div style="text-align:center; background:#1a1208; color:#e8d5b5; padding:12px; border:4px solid #6b4a2b; font-family:'Courier New';">
            <h3 style="margin:0;">PACK THE WAGON</h3>
            <p style="margin:4px 0; font-size:0.85em;">Loose cargo drags. Tight cargo travels. &nbsp;|&nbsp; TIME: <span id="packing-timer" style="color:#FFD700;">${s.timeLeft}s</span> &nbsp;|&nbsp; PACKED: ${placedArea}/${s.totalArea}</p>
            ${selectedPreview}
            <div id="packing-board" style="display:grid; grid-template-columns: repeat(${PACKING_COLS}, 1fr); gap:2px; margin:8px auto; max-width:420px;">
                ${cellSpans}
            </div>
            <div id="packing-tray" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; min-height:2.2em; margin:6px 0;">
                ${trayChips || '<span style="color:#7CFC00;">Everything is aboard!</span>'}
            </div>
            <p style="min-height:2.2em; font-size:0.8em; color:#c8b58f; margin:6px 0;">${s.status}</p>
            <div class="buttons">
                <button id="packing-rotate-btn" class="btn btn-info" title="Spin it. Tetris was invented for exactly this moment.">ROTATE (R)</button>
                <button id="packing-done-btn" class="btn btn-success" title="Good enough is the pioneer's motto.">DONE PACKING</button>
                <button id="packing-skip-btn" class="btn btn-warning" title="Just throw it all in. What could go wrong.">Just Throw It All In</button>
            </div>
        </div>
    `;

    const boardEl = document.getElementById('packing-board');
    if (boardEl) boardEl.onclick = (e) => {
        const el = e.target.closest('[data-pcell]');
        if (el) handlePackingBoardTap(Number(el.dataset.pcell));
    };
    const trayEl = document.getElementById('packing-tray');
    if (trayEl) trayEl.onclick = (e) => {
        const el = e.target.closest('[data-ptray]');
        if (!el || !packingState || packingState.over) return;
        const id = Number(el.dataset.ptray);
        if (packingState.selected === id) { rotateSelectedPiece(); } // tap again = rotate
        else { packingState.selected = id; packingState.status = `${packingState.pieces[id].label} selected. Tap the bed to place, R to rotate.`; renderPackingBoard(); }
    };
    const rotBtn = document.getElementById('packing-rotate-btn');
    if (rotBtn) rotBtn.onclick = () => rotateSelectedPiece();
    const doneBtn = document.getElementById('packing-done-btn');
    if (doneBtn) doneBtn.onclick = () => scorePackingGame();
    const skipBtn = document.getElementById('packing-skip-btn');
    if (skipBtn) skipBtn.onclick = () => {
        // Skipping = a haphazard pile. Mildly punished, honestly labeled.
        finishPackingWith(1.05, "HEAP MODE", "You throw everything in and hope physics is feeling generous today.");
    };
}

function scorePackingGame() {
    const s = packingState;
    if (!s || s.over) return;
    const placedArea = s.pieces.filter(p => p.placed).reduce((sum, p) => sum + p.cells.length, 0);
    const frac = placedArea / s.totalArea;
    let mod, rating, blurb;
    if (frac >= 1.0) {
        const timeBonus = s.timeLeft > 20;
        mod = timeBonus ? 0.88 : 0.90;
        rating = "MASTER PACKER";
        AchievementManager.unlock('master_packer', 'Master Packer');
        blurb = timeBonus
            ? "Every item locked in place with time to spare. The oxen nod in respect."
            : "Every item locked in place. The wagon rides like it's half empty.";
    } else if (frac >= 0.8) {
        mod = 0.95; rating = "SOLID PACK";
        blurb = "Nearly everything stowed tight. A few loose ends rattle, but it hauls well.";
    } else if (frac >= 0.6) {
        mod = 1.0; rating = "ACCEPTABLE";
        blurb = "It's... fine. Standard pioneer chaos. The wagon pulls exactly as heavy as it is.";
    } else if (frac >= 0.4) {
        mod = 1.05; rating = "LOOSE LOAD";
        blurb = "Half the cargo shifts with every bump. The oxen can feel it, and they are judging you.";
    } else {
        mod = 1.10; rating = "AVALANCHE IN A BOX";
        blurb = "The load slides around like an angry ecosystem. Effectively heavier than it has any right to be.";
    }
    finishPackingWith(mod, rating, blurb);
}

function finishPackingWith(mod, rating, blurb) {
    const s = packingState;
    if (!s || s.over) return;
    s.over = true;
    if (s.interval) clearInterval(s.interval);
    if (s.keyHandler) document.removeEventListener('keydown', s.keyHandler);

    wagon.packingModifier = mod;
    wagon.isPacked = true; // packed, for better or worse — clears leaveFortPrompt's nag
    const raw = wagon.getWagonWeight();
    const eff = wagon.getEffectiveWeight();
    const deltaLine = (mod < 1.0)
        ? `Your ${raw} lbs of cargo now pulls like <strong>${eff} lbs</strong>.`
        : (mod > 1.0 ? `Your ${raw} lbs of cargo now drags like <strong>${eff} lbs</strong>.` : `Your ${raw} lbs of cargo pulls like exactly ${eff} lbs.`);

    const onDone = s.onDone;
    packingState = null;

    const content = modalChild;
    if (!content) { if (onDone) onDone(); return; }
    content.innerHTML = `
        <div style="text-align:center; background:#1a1208; color:#e8d5b5; padding:20px; border:4px solid #6b4a2b; font-family:'Courier New';">
            <h3 style="color:#FFD700;">${rating}</h3>
            <p>${blurb}</p>
            <p style="font-size:0.9em;">${deltaLine}</p>
            <button id="packing-continue-btn" class="btn btn-success" title="The wagon is packed. Loosely defined.">HIT THE TRAIL</button>
        </div>
    `;
    const btn = document.getElementById('packing-continue-btn');
    if (btn) btn.onclick = () => { if (onDone) onDone(); };
    textUpdateUI();
}

// silent cleanup for abandoned sessions (modal replaced from outside)
function endPackingGame(silent) {
    const s = packingState;
    if (!s) return;
    s.over = true;
    if (s.interval) clearInterval(s.interval);
    if (s.keyHandler) document.removeEventListener('keydown', s.keyHandler);
    packingState = null;
}

// Fort exit flow: offer the packing puzzle on the way out.
function leaveFortPrompt() {
    // Already packed since the last purchase — nothing to nag about. Leave
    // outright instead of asking the same question twice in a row.
    if (wagon.isPacked) {
        toggleModal('#myModal');
        return;
    }
    const content = modalChild;
    content.innerHTML = `
        <h3>Ready to Leave?</h3>
        <p>The wagon bed is a mess of crates, barrels, and regret. Take a minute to pack it properly?</p>
        <div class="buttons">
            <button id="fort-pack-btn" class="btn btn-info" title="Pack it properly. Future-you will be grateful.">Pack the Wagon</button>
            <button id="fort-leave-btn" class="btn btn-success" title="Leave it a mess. Rebel.">Just Leave</button>
        </div>
    `;
    const packBtn = document.getElementById('fort-pack-btn');
    if (packBtn) packBtn.onclick = () => startPackingGame({ onDone: () => toggleModal('#myModal') });
    const leaveBtn = document.getElementById('fort-leave-btn');
    if (leaveBtn) leaveBtn.onclick = () => toggleModal('#myModal');
}

// --- The Brothel -----------------------------------------------------
const BROTHEL_INSULTS = [
    "Beauty is only skin deep, but your ugly goes clean to the bone.",
    "Even the Ghost of '47 refuses to haunt a face that looks like a fatal runtime error.",
    "I'm not saying you're ugly, but your reflection just asked for a transfer.",
    "If ugliness were bricks, you'd be the Great Wall of China.",
    "If ugliness were premium currency, you'd be a one-man California Gold Rush.",
    "If ugly was a crime, you'd be serving a life sentence.",
    "Our standards are low, but we aren't desperate enough to hire a bipedal pack mule.",
    "The local doctor tried to 'Rub Dirt On It,' thinking your face was a horrific trail wound.",
    "The Shoshone guide took one look at you and doubled his river crossing fee for emotional distress.",
    "We are in the business of hospitality, not administering a visual jump-scare to weary travelers.",
    "We're a premium establishment; we don't hire low-poly, background assets.",
    "You fell out of the ugly tree and hit every branch on the way down.",
    "You have a face made for radio and a voice made for telegraph.",
    "You have the charm of an ungreased wagon tongue and the facial symmetry of a glitched cobblestone.",
    "You look like a before-and-after of a firework accident.",
    "You look like a bulldog eating a wasp.",
    "You look like a Cleveland femur that a dog buried, dug up, and then threw up.",
    "You look like a failed science experiment.",
    "You look like a hairball with feelings.",
    "You look like a pancake that flipped wrong.",
    "You look like a placeholder asset the developers forgot to delete before the beta build went live.",
    "You look like a potato that tried its best.",
    "You look like salted pork that's been left out in the Great Basin sun since March.",
    "You look like your character model completely failed to load from the neck up.",
    "You make a blobfish look like a supermodel.",
    "You're on the Richter scale of ugly.",
    "You're so ugly when you tried to play fetch, the dog didn't come back.",
    "You're so ugly you have to trick or treat by telegraph.",
    "You're so ugly your last job was as a scarecrow.",
    "You're so ugly, buzzards circle you out of professional curiosity.",
    "You're so ugly, echo doesn't even bother coming back.",
    "You're so ugly, even your shadow refuses to follow you.",
    "You're so ugly, flowers wilt when you walk by.",
    "You're so ugly, milk expired just looking at you.",
    "You're so ugly, mirrors crack just to avoid you.",
    "You're so ugly, mosquitoes only bite you for revenge.",
    "You're so ugly, squirrels throw nuts at you.",
    "You're so ugly, the daguerreotype man refunded your money and burned the plate.",
    "You're so ugly, the dark is afraid of you.",
    "You're so ugly, the Donner Party would have voted to eat you first just so they didn't have to look at you across the campfire.",
    "You're so ugly, the oxen offered to pull the wagon faster just to get away from you.",
    "You're so ugly, the scarecrow filed a grievance about being compared to you.",
    "You're so ugly, the tumbleweeds tumble the other way.",
    "You're so ugly, when you crossed the river, the fish swam upstream out of principle.",
    "You're so ugly, when you look in the mirror, your reflection ducks.",
    "You're so ugly, when you tried to fish, the Sturgeon-General issued a public health warning.",
    "You're so ugly, when you were born, the doctor slapped your parents.",
    "You're so ugly, you don't need a mask for Halloween.",
    "You're so ugly, you make a plate of cold salted pork and raccoon meat look like fine dining.",
    "You're so ugly, you make double dysentery look like a mild cosmetic blemish.",
    "You're so ugly, you make onions cry.",
    "You're so ugly, you scared the hiccups out of me.",
    "You're so ugly, you stuck your head out of the wagon and got arrested for mooning.",
    "You're so ugly, you're the reason man invented brown paper bags.",
    "You're so ugly, your birth certificate is an apology letter from the stork.",
    "You're so ugly, your birthday candles cry.",
    "You're so ugly, your face should come with a spoiler alert.",
    "You're so ugly, your mother breast-fed you through a straw.",
    "You're so ugly, your portraits hang themselves.",
    "You're so ugly, your reflection once asked for a restraining order.",
    "You're so ugly, your shadow files for time off.",
    "You're so ugly, your shadow wears a bag.",
    "You're so ugly, your wanted poster was taken down for public decency.",
    "You're the human version of a naked mole rat.",
    "Your face looks like an axle that's been thoroughly broken by a head-on collision with Dick Cheney.",
];

let telegraphState = null;

const TELEGRAPH_TIME_FACTOR = { "Easy": 1.4, "Normal": 1.0, "Hard": 0.75, "New Game+": 0.6 };
const TELEGRAPH_PACE_CPS = 3.0; // assumed baseline typing pace: ~36 WPM at 5 chars/word
const TELEGRAPH_BASE_PAYOUT = 40;

// Used only at Independence (totalDistance === 0) — nothing unfortunate has
// happened yet, so the tone is anticipatory instead of a war story.
const TELEGRAPH_SEND_OFF_MESSAGES = [
    "ABOUT TO LEAVE INDEPENDENCE STOP EVERYONE SAYS OREGON IS NICE THIS TIME OF CENTURY STOP",
    "ACTIVATED CALIFORNIA ROUTE PROTOCOL STOP THE EDIBLE ASSET CHECKLIST IS SAFELY PACKED STOP HEADING INTO THE DESERT LANE STOP",
    "BOUGHT TEN BARRELS OF WATER AND A DUBIOUS AMOUNT OF CONFIDENCE STOP HEADING WEST STOP",
    "CHOSE HARD DIFFICULTY ACCIDENTALLY STOP PERMADEATH IS NOW A LIFESTYLE CHOICE STOP WAVING GOODBYE TO MISSOURI FOR GOOD STOP",
    "INDEPENDENCE WAS TRULY EASY TO LEAVE STOP DRAGGING THE CHILDREN ON A DEADLY LOGISTICAL NIGHTMARE TO ESCAPE IT STOP",
    "MATTS GENERAL STORE WISHED OUR WEIRD NUDIST FAMILY LUCK STOP DEPARTING THE SAFE ZONE HUB WITH ZERO CLOTHES STOP",
    "NAMED THE WAGON OREGON OR BUST STOP PRAYING THE TEXTURE MESH HOLDS TOGETHER WEST OF THE MISSOURI EXPEDITION STOP",
    "PACKED TWO THOUSAND POUNDS OF SALTED PORK STOP PREPARED TO OVERCLOCK THE CLOCK SPEED PACE METERS AND DEPART STOP",
    "SELECTED GAMER PROFESSION AND PROMPTLY SKIPPED THE TUTORIAL DIALOGUE STOP PREPARED TO GRIND ALL THE WAY TO WIN STATE STOP",
    "SETTING OUT AT DAWN STOP WAGON IS PACKED AND SO IS MY NERVE STOP WISH US LUCK STOP",
    "THE OXEN LOOK SKEPTICAL OF THIS WHOLE PLAN STOP FRANKLY SO DO I STOP DEPARTING ANYWAY STOP",
    "TRADED ALL MY LOOSE POCKET CHANGE FOR A WORLD OKAYEST PIONEER HOOF MUG STOP SETTING OFF INSTANTLY STOP",
];

// The general pool: funny or unfortunate things that happen on the trail.
const TELEGRAPH_MESSAGES = [
    "A STRANGER OFFERED TO RACE US TO THE NEXT FORT STOP WE DECLINED STOP HE RACED US ANYWAY STOP HE LOST STOP",
    "A TRAVELING SALESMAN SOLD ME A MAP TO A SHORTCUT STOP IT WAS A DRAWING OF A DUCK STOP HE IS LONG GONE STOP",
    "ACCEPTED A DINNER INVITATION FROM THE DONNER PARTY STOP THEY ASKED IF MY SHINS WERE EDIBLE ASSETS STOP WE RAN AWAY FAST STOP",
    "ACCIDENTALLY SHOT BY DICK CHENEY WHILE HUNTING STOP FACE FULL OF BIRDSHOT STOP HE DEMANDED AN APOLOGY STOP SEND OINTMENT STOP",
    "APPLIED LOCAL LEECHES TO TREAT A TRAIL SICKNESS STOP NOW WE HAVE LESS BLOOD AND THE SAME ILLNESS STOP SEND REAL DOCTOR STOP",
    "ATTEMPTED A FRAME PERFECT SPEEDRUN SHORTCUT STOP INVISIBLE WALL STRUCK BACK STOP BROKE AN AXLE AND MY DIGNITY STOP SEND CASH STOP",
    "CAPTURED BY A NATION OF COUCH CUSHIONS AND DUVET COVERS STOP THE ECONOMY RUNS ON JUICE BOXES STOP WE ARE UTTERLY BANKRUPT STOP",
    "CHALLENGED A BARD TO AN INSULT DUEL STOP HE COMPARED MY TROUSERS TO A BLIND BADGER STOP CURRENTLY CRYING IN THE WAGON STOP",
    "COUSIN EUGENE ASKS IF WE HAVE FOUND GOLD YET STOP TELL HIM WE FOUND DYSENTERY INSTEAD STOP CLOSE ENOUGH STOP",
    "DOCTOR PRESCRIBED RUBBING DIRT ON IT STOP RESULTS INCONCLUSIVE STOP TRYING SALT NEXT STOP WISH US LUCK STOP",
    "ENTERED A ZONE CALLED THE UNCANNY VALLEY STOP THE CLOUDS ARE WIREFRAMES AND THE DIRTY INTERNET TEXTURES ARE AGGRESSIVELY FLICKERING STOP",
    "FOUND A MAN CLAIMING TO BE A GHOST STOP HE ASKED US FOR DIRECTIONS STOP EVEN THE DEAD ARE LOST OUT HERE STOP",
    "JESUS TOOK THE WHEEL QUITE LITERALLY STOP GAVE IT TO A WEALTHIER PARTY IN AN EXPENSIVE DLC ZONE STOP WAGON IS STUCK STOP",
    "LOST THE THIRD WAGON WHEEL THIS WEEK STOP WE ARE NOW DRAGGING A VERY EXPENSIVE SLED STOP",
    "MET A MAN CLAIMING TO BE BIGFOOT STOP HE OWED ME FIVE DOLLARS FROM A CARD GAME STOP HE PAID IN ACORNS STOP",
    "OXEN NAMED PICKLES REFUSED TO CROSS THE RIVER STOP HE HAS APPOINTED HIMSELF EXPEDITION LEADER STOP SEND CARROTS STOP",
    "PLAYED CARDS AT THE LAST FORT STOP LOST THE SHIRT OFF MY BACK STOP LITERALLY STOP ASK NO QUESTIONS STOP",
    "RAFTED DOWN A RIVER OF PURE LIQUID CHOCOLATE STOP WAGON TASTES FANTASTIC BUT HAS UTTERLY SUNK STOP SEND A LIFE JACKET STOP",
    "RAN OUT OF BULLETS DURING A HUNT STOP THREW A ROCK AT A RABBIT OUT OF PRINCIPLE STOP MISSED STOP",
    "SAW A MAN SELLING SNAKE OIL STOP BOUGHT THREE BOTTLES STOP FEEL WORSE NOW STOP SEND REAL MEDICINE STOP",
    "SURVIVED A RIVER CROSSING ENTIRELY BY ACCIDENT STOP THE WAGON JUST FLOATED STOP WE DID NOT PLAN FOR THAT STOP",
    "THE OXEN ATE MY HAT STOP THEN THEY ATE THE SPARE HAT STOP WE ARE NOW A HATLESS FAMILY STOP",
    "THE OXEN HAVE FORMED A UNION STOP THEY ARE DEMANDING BETTER GRASS STOP NEGOTIATIONS ARE ONGOING STOP",
    "THE WAGON HAD A NAME BUT IT DIED STOP WE ARE NOW WALKING STOP MORALE IS AT AN ALL TIME LOW STOP",
    "TRADED OUR LAST BARREL OF WATER FOR A SUSPICIOUSLY SHINY ROCK STOP REGRET IS SETTING IN STOP",
    "UNCLE HAROLD WANTS HIS LOAN BACK STOP TELL HIM THE RIVER TOOK IT STOP THE RIVER TAKES EVERYTHING STOP",
    "VISITED THE FORT BROTHEL LOOKING FOR REVENUE STOP THEY CALLED ME A PLACEHOLDER ASSET AND SLAMMED THE DOOR STOP MORALE BROKEN STOP",
    "WE HAVE BEEN EATING THE SAME JERKY FOR TWO WEEKS STOP IT HAS DEVELOPED A PERSONALITY STOP NOT A GOOD ONE STOP",
];

function telegraphMessagePool() {
    if (wagon.totalDistance === 0) return TELEGRAPH_SEND_OFF_MESSAGES.slice();
    const pool = TELEGRAPH_MESSAGES.slice();
    // A couple of personalized entries, only offered when they'd actually be true —
    // real news is better news.
    if (wagon.flags && wagon.flags.has_dog) {
        const dName = wagon.flags.dog_name || "Buster";
        pool.push(`${dName.toUpperCase()} THE DOG HAS APPOINTED HIMSELF NAVIGATOR STOP HE IS WRONG OFTEN BUT CONFIDENT STOP SEND TREATS STOP`);
    }
    if (wagon.graveyard && wagon.graveyard.length > 0) {
        const lost = wagon.graveyard[wagon.graveyard.length - 1];
        pool.push(`SAD NEWS STOP WE LOST ${String(lost.name).toUpperCase()} TO ${String(lost.cause).toUpperCase()} STOP THE TRAIL DOES NOT CARE HOW YOU FEEL ABOUT IT STOP`);
    }
    return pool;
}

function isTelegraphSent() {
    return !!(wagon.flags && wagon.flags[`telegraphSent_${wagon.currentLandmark}`]);
}

function openTelegraphOffice() {
    const content = modalChild;
    if (isTelegraphSent()) {
        content.innerHTML = `
            <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
                <h3 style="color:#e0a83c;">📨 Telegraph Office</h3>
                <p>"Already sent your wire from here, friend. Lines only carry so much traffic — try the next outpost."</p>
                <div class="buttons"><button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back</button></div>
            </div>
        `;
        if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
        return;
    }
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#e0a83c;">📨 Telegraph Office</h3>
            <p style="color:#fff;">The operator slides you a pencil. "Wire folks back home, if you've a mind to. Fast, accurate hands get paid better — the line charges by the minute either way."</p>
            <p style="color:#aaa; font-size:0.85em;">One telegraph per fort. Type the message shown before the bar runs out.</p>
            <div class="buttons">
                <button class="btn btn-warning" ${actionAttrs('startTelegraphGame')}>Send a Telegraph</button>
                <button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function startTelegraphGame() {
    if (isTelegraphSent()) { openTelegraphOffice(); return; }
    const pool = telegraphMessagePool();
    const text = pool[Math.floor(Math.random() * pool.length)];

    const timeFactor = TELEGRAPH_TIME_FACTOR[wagon.difficulty] || 1.0;
    // Teachers don't get a skill elsewhere in the game — this is their niche:
    // steady penmanship buys extra time on the wire.
    const teacherBonus = (wagon.professionName === "Teacher") ? 1.15 : 1.0;
    const totalTime = Math.max(8, (text.length / TELEGRAPH_PACE_CPS) * timeFactor * teacherBonus);

    telegraphState = {
        text,
        totalTime,
        timeLeft: totalTime,
        finished: false,
        interval: null,
    };

    renderTelegraphUI();

    telegraphState.interval = setInterval(() => {
        telegraphState.timeLeft -= 0.1;
        if (telegraphState.timeLeft <= 0) {
            telegraphState.timeLeft = 0;
            updateTelegraphBar();
            finishTelegraphGame();
            return;
        }
        updateTelegraphBar();
    }, 100);
}

function renderTelegraphUI() {
    const s = telegraphState;
    if (!s) return;
    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#e0a83c;">📨 Mavis Beacon Teaches Telegraph</h3>
            <div style="background:#333; border-radius:6px; height:14px; margin: 10px auto; max-width: 420px; overflow:hidden;">
                <div id="telegraph-bar" style="height:100%; width:100%; background:#3ec46d; transition: width 0.1s linear, background 0.3s linear;"></div>
            </div>
            <p id="telegraph-target" style="font-size:1.15em; line-height:1.6; letter-spacing:0.5px; max-width:520px; margin:16px auto; color:#999; word-wrap:break-word; overflow-wrap:break-word; white-space:normal;"></p>
            <input id="telegraph-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false"
                   style="width:80%; max-width:480px; padding:10px; font-size:1.1em; font-family:'Courier New'; text-align:center;"
                   placeholder="Start typing...">
        </div>
    `;
    renderTelegraphProgress();

    const input = document.getElementById('telegraph-input');
    if (input) {
        input.focus();
        input.addEventListener('input', () => {
            renderTelegraphProgress();
			AudioManager.playSound('key');
            if (input.value.length >= s.text.length) finishTelegraphGame();
        });
    }
}

function renderTelegraphProgress() {
    const s = telegraphState;
    if (!s) return;
    const input = document.getElementById('telegraph-input');
    const target = document.getElementById('telegraph-target');
    if (!input || !target) return;
    const typed = input.value;
    let html = '';
    for (let i = 0; i < s.text.length; i++) {
        const ch = s.text[i]; // real space, not &nbsp; — nbsp blocks line-wrapping, which is exactly what was overflowing the modal
        if (i < typed.length) {
            html += typed[i].toLowerCase() === s.text[i].toLowerCase()
                ? `<span style="color:#3ec46d;">${ch}</span>`
                : `<span style="color:#ff6666; text-decoration:underline;">${ch}</span>`;
        } else {
            html += `<span style="color:#777;">${ch}</span>`;
        }
    }
    target.innerHTML = html;
}

function updateTelegraphBar() {
    const s = telegraphState;
    if (!s) return;
    const bar = document.getElementById('telegraph-bar');
    if (!bar) return;
    const frac = Math.max(0, s.timeLeft / s.totalTime);
    bar.style.width = `${(frac * 100).toFixed(1)}%`;
    bar.style.background = frac > 0.5 ? '#3ec46d' : (frac > 0.2 ? '#e0a83c' : '#c0392b');
}

function finishTelegraphGame() {
    const s = telegraphState;
    if (!s || s.finished) return;
    s.finished = true;
    if (s.interval) clearInterval(s.interval);

    const input = document.getElementById('telegraph-input');
    const typed = input ? input.value : '';
    const attempted = Math.min(typed.length, s.text.length);
    let correct = 0;
    for (let i = 0; i < attempted; i++) {
        if (typed[i].toLowerCase() === s.text[i].toLowerCase()) correct++;
    }
    const completionFrac = attempted / s.text.length;
    const accuracyFrac = attempted > 0 ? (correct / attempted) : 0;
    const payout = Math.round(TELEGRAPH_BASE_PAYOUT * completionFrac * accuracyFrac);

    wagon.money += payout;
    if (!wagon.flags) wagon.flags = {};
    wagon.flags[`telegraphSent_${wagon.currentLandmark}`] = true;

    if (payout >= TELEGRAPH_BASE_PAYOUT * 0.95) {
        AchievementManager.unlock('fast_fingers', 'Fast Fingers');
    }

    const replies = [
		"Reply wires back: \"GLAD YOU'RE ALIVE STOP MOTHER SAYS HELLO STOP TRY NOT TO DIE STOP\"",
        "Reply wires back: \"CHENEY SENT A BASKET OF MUFFINS AS AN APOLOGY STOP HE BLAMES INPUT LAG AND SLOW REFLEXES STOP GET WELL SOON STOP\"",
        "Reply wires back: \"COUSIN EUGENE ROFFLED AT YOUR DYSENTERY REPORT STOP EVERYONE AGREES NEBRASKA IS STILL METABOLICALLY INFERIOR TO MISSOURI STOP STAY STRONG STOP\"",
        "Reply wires back: \"GLAD THE WAGON FLOATED STOP THE ARCHITECTS WORK IN MYSTERIOUS CODEWAYS STOP CONTINUE PUNCHING FLORA FOR EXTRA INVENTORY PADDING STOP\"",
        "Reply wires back: \"GOOD TO HEAR FROM YOU STOP THE DOG YOU LEFT BEHIND MISSES YOU SLIGHTLY STOP\"",
        "Reply wires back: \"HAROLD SAYS NO MORE LOANS UNTIL YOU REACH A GENUINE SHOP STOP WE SPENT YOUR INHERITANCE ON LUXURY RAFT INSURANCE STOP\"",
        "Reply wires back: \"NEWS RECEIVED STOP PLEASE SEND MORE MONEY NEXT TIME STOP ALSO WE ARE PROUD OF YOU STOP\"",
        "Reply wires back: \"RECEIVED YOUR UPDATE STOP EVERYONE AT THE TAVERN IS PLACING BETS ON YOU STOP\"",
        "Reply wires back: \"TELL THE EXPEDITION LEADER PICKLES THE EX THAT WE FULLY SUPPORT HIS UNION DEMANDS STOP EXTRA GRASS ACCORDED STOP\"",
        "Reply wires back: \"WE PRAYED TO RNGESUS FOR YOUR REVERSE ROUTE RUN STOP MOTHER SAYS TO ATTUNE YOUR BOOTS AND EQUIP COCAINE SYRUP STOP\"",
        "Reply wires back: \"WE SENT DIRT AND SALT VIA MAIL CARRIER TO PATCH UP YOUR FACIAL ACCIDENTS STOP PROFESSIONAL REMEDIES ARE INCONCLUSIVE STOP\"",
        "Reply wires back: \"WE SENT FIVE DOLLARS STOP WE HAD TO SELL THE PIANO TO AFFORD THE TELEGRAM FEES STOP DO NOT SQUANDER IT STOP\"",
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];

    AudioManager.playSound(payout > 0 ? 'gold' : 'miss');
	AudioManager.playSound('telegraph');
    textUpdateUI();

    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#e0a83c;">📨 Telegraph Sent</h3>
            <p style="color:#ccc; font-size:0.9em;">Typed ${attempted}/${s.text.length} characters, ${(accuracyFrac * 100).toFixed(0)}% accurate.</p>
            <p style="color:${payout > 0 ? '#00e676' : '#ff6666'}; font-weight:bold; font-size:1.2em;">Earned $${payout}</p>
            <p style="color:#e0a83c; font-style:italic; margin-top:16px;">${translateSanity(reply)}</p>
            <div class="buttons"><button class="btn btn-success" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back to Fort</button></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    telegraphState = null;
}

function visitBrothel() {
    const content = modalChild;
    const insult = BROTHEL_INSULTS[Math.floor(Math.random() * BROTHEL_INSULTS.length)];
    AudioManager.playSound('sad');
    content.innerHTML = `
        <div style="text-align:center; background:#2a0a1a; color:#eee; padding:24px; border:4px solid #8b2b5a; font-family:'Courier New';">
            <h3 style="color:#ff69b4;">💋 The Velvet Garter</h3>
            <p>${translateSanity("They decline to hire you at the brothel.")}</p>
            <p style="color:#ffb6c1; font-style:italic;">"${translateSanity(insult)}"</p>
            <div class="buttons">
                <button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Slink Away</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

const CARD_SUITS = [
    { name: "Spades",   sym: "♠", base: 0x1F0A0, color: "#1a1a1a" },
    { name: "Hearts",   sym: "♥", base: 0x1F0B0, color: "#c0392b" },
    { name: "Diamonds", sym: "♦", base: 0x1F0C0, color: "#c0392b" },
    { name: "Clubs",    sym: "♣", base: 0x1F0D0, color: "#1a1a1a" }
];
// Offsets within each suit's Unicode block. 12 (Knight) is skipped — it's
// not part of a standard 52-card deck.
const CARD_RANKS = [
    { name: "A",  offset: 1,  value: 11 },
    { name: "2",  offset: 2,  value: 2 },
    { name: "3",  offset: 3,  value: 3 },
    { name: "4",  offset: 4,  value: 4 },
    { name: "5",  offset: 5,  value: 5 },
    { name: "6",  offset: 6,  value: 6 },
    { name: "7",  offset: 7,  value: 7 },
    { name: "8",  offset: 8,  value: 8 },
    { name: "9",  offset: 9,  value: 9 },
    { name: "10", offset: 10, value: 10 },
    { name: "J",  offset: 11, value: 10 },
    { name: "Q",  offset: 13, value: 10 },
    { name: "K",  offset: 14, value: 10 }
];
const CARD_BACK = String.fromCodePoint(0x1F0A0); // generic playing-card back

const GAMBLING_WAGER_TIERS = [10, 25, 50, 100];
const INSULT_DUEL_WAGER_TIERS = [5, 10, 25];
// Anyone can cheat. Getting away with it is another matter — a lifetime of
// haggling (the Trade skill) teaches you where the dealer's eyes are.
function cheatCatchChance() {
    return hasSkill("Trade") ? 0.15 : 0.40;
}

function buildShuffledDeck() {
    const deck = [];
    CARD_SUITS.forEach(suit => {
        CARD_RANKS.forEach(rank => {
            deck.push({
                char: String.fromCodePoint(suit.base + rank.offset),
                rank: rank.name,
                value: rank.value,
                suit: suit.name,
                sym: suit.sym,
                color: suit.color
            });
        });
    });
    // Fisher-Yates using the seeded gambling RNG, not Math.random()
    for (let i = deck.length - 1; i > 0; i--) {
        const j = gamblingRandomInt(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function blackjackHandValue(hand) {
    let total = hand.reduce((sum, c) => sum + c.value, 0);
    let aces = hand.filter(c => c.rank === "A").length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function renderCard(card, faceDown = false) {
    if (faceDown) {
        return `<span style="
            display:inline-block; width:2.6em; height:3.6em; margin:4px; border-radius:8px; vertical-align:middle; font-size:1.5em;
            background: repeating-linear-gradient(135deg, #6b1d3c, #6b1d3c 6px, #8b2b52 6px, #8b2b52 12px);
            border: 2px solid #d4af37;
            box-shadow: 0 5px 10px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(255,255,255,0.15);
        "></span>`;
    }
    return `<span style="
        position:relative; display:inline-block; width:2.6em; height:3.6em; margin:4px; border-radius:8px; vertical-align:middle; font-size:1.5em;
        background: linear-gradient(160deg, #ffffff, #efe9da);
        border: 1px solid #bbb;
        box-shadow: 0 5px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.85);
        color: ${card.color}; font-family: Georgia, 'Times New Roman', serif;
    ">
        <span style="position:absolute; top:0.1em; left:0.18em; font-size:0.62em; line-height:1.05; font-weight:bold; text-align:center;">${card.rank}<br>${card.sym}</span>
        <span style="position:absolute; bottom:0.1em; right:0.18em; font-size:0.62em; line-height:1.05; font-weight:bold; text-align:center; transform:rotate(180deg);">${card.rank}<br>${card.sym}</span>
        <span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-52%); font-size:1.55em; line-height:1;">${card.sym}</span>
    </span>`;
}

function rollDie() {
    return gamblingRandomInt(6) + 1;
}

const DIE_PIP_MAP = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

function dieFaceCells(value, pipEm) {
    const pips = DIE_PIP_MAP[value] || [];
    let cells = '';
    for (let i = 0; i < 9; i++) {
        cells += `<span style="display:flex; align-items:center; justify-content:center;">${
            pips.includes(i) ? `<span style="width:${pipEm}em; height:${pipEm}em; border-radius:50%; background:#1a1a1a; box-shadow: inset 0 1px 1px rgba(255,255,255,0.4);"></span>` : ''
        }</span>`;
    }
    return cells;
}

function renderDie(value) {
    return `<span style="
        display:inline-grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
        width:2em; height:2em; padding:0.24em; box-sizing:border-box;
        margin: 5px; border-radius: 22%; vertical-align:middle;
        background: linear-gradient(160deg, #ffffff, #e2e2e2);
        border: 1px solid #999;
        box-shadow: 0 5px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.9);
    ">${dieFaceCells(value, 0.34)}</span>`;
}

// Small inline die "chip" for use inside sentences and button labels.
function renderDieMini(face) {
    return `<span style="
        display:inline-grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
        width:1.25em; height:1.25em; padding:0.14em; box-sizing:border-box;
        margin: 0 2px; border-radius: 22%; vertical-align:-0.25em;
        background: #ffffff; border: 1px solid #888;
        box-shadow: 0 1px 2px rgba(0,0,0,0.4);
    ">${dieFaceCells(face, 0.2)}</span>`;
}

// Ones are wild for every face except a bid ON ones themselves.
function countDiceForFace(allDice, face) {
    if (face === 1) return allDice.filter(d => d === 1).length;
    return allDice.filter(d => d === face || d === 1).length;
}

function isSaloonBanned() {
    return !!(wagon.flags && wagon.flags[`saloonBanned_${wagon.currentLandmark}`]);
}

function banFromSaloon() {
    if (!wagon.flags) wagon.flags = {};
    wagon.flags[`saloonBanned_${wagon.currentLandmark}`] = true;
}

function renderWagerButtons(startAction, tiers = GAMBLING_WAGER_TIERS) {
    const options = tiers.filter(w => w <= wagon.money);
    if (!options.length) {
        return `<p style="color:#ff6666;">You don't have enough on you to sit at this table.</p>`;
    }
    return `<div class="buttons">${options.map(w =>
        `<button class="btn btn-info" ${actionAttrs(startAction, [w])}>Wager $${w}</button>`
    ).join('')}</div>`;
}

function openSaloon() {
    const content = modalChild;
    if (gamblingBlocked()) {
        content.innerHTML = `
            <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
                <h3 style="color:#e0a83c;">🚪 The Saloon</h3>
                <p>${translateSanity("You reach for the door and hear a Tennessee drawl in your head: 'The lottery is a tax on people who can't do math.' You are on a written budget. You keep walking.")}</p>
                <div class="buttons"><button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back (Beans and Rice Await)</button></div>
            </div>
        `;
        if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
        return;
    }
    if (isSaloonBanned()) {
        content.innerHTML = `
            <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
                <h3 style="color:#e0a83c;">🚪 The Saloon</h3>
                <p>${translateSanity('A hand the size of a ham hock plants itself on your chest. "Not after last time," the bouncer says. You\'re not getting back in here.')}</p>
                <div class="buttons"><button class="btn btn-danger" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Back</button></div>
            </div>
        `;
        if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
        return;
    }

    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#ddd; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#e0a83c;">🥃 The Lucky Ox Saloon</h3>
            <p style="color:#fff;">${translateSanity("The sign says 'Licker in the front and Poker in the rear'. You don't see the poker but you see Blackjack, Liar's Dice and some Insult Dueling.")}</p>
            <p style="color:#aaa; font-size:0.85em;">You have $${wagon.money.toFixed(2)}.</p>
            <div class="buttons">
                <button class="btn btn-warning" ${actionAttrs('openBlackjackTable')}>♠ Play Blackjack</button>
                <button class="btn btn-warning" ${actionAttrs('openDiceTable')}>🎲 Play Liar's Dice</button>
                <button class="btn btn-warning" ${actionAttrs('openInsultDuelTable', [], { noTitle: true })} ${wagon.flags[`duelChampion_${wagon.currentLandmark}`] ? 'disabled title="Word got around. Nobody here will trade insults with you anymore."' : 'title="The pen is mightier, but the tongue is meaner."'}>🗯️ Insult Dueling</button>
                <button class="btn btn-success" ${actionAttrs('returnToFortTalk', [wagon.currentLandmark])}>Leave Saloon</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

// ---------- Blackjack ----------

function openBlackjackTable() {
    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center; background:#0b3d24; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">♠ Blackjack</h3>
            <p style="font-size:0.9em; color:#ddd;">${translateSanity('The dealer cracks open a fresh deck. "Closest to 21 without going over. Blackjack pays double. House stands on 17."')}</p>
            <p style="color:#aaa; font-size:0.85em;">You have $${wagon.money.toFixed(2)}.</p>
            ${renderWagerButtons('startBlackjack')}
            <div class="buttons" style="margin-top:10px;"><button class="btn btn-danger" ${actionAttrs('openSaloon')}>Back</button></div>
        </div>
    `;
}

function startBlackjack(wager) {
    if (wagon.money < wager || isSaloonBanned() || gamblingBlocked()) { updateActionPrompt("You can't cover that bet."); return; }
    wagon.money -= wager;

    const deck = buildShuffledDeck();
    const playerCards = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    wagon.saloonState = {
        game: "blackjack",
        baseWager: wager,
        deck,
        // Multiple hands to support splitting. Each hand carries its own
        // wager so a doubled or split hand settles independently.
        hands: [{ cards: playerCards, wager, done: false, isSplit: false, doubled: false, outcome: null, resultMsg: "" }],
        active: 0,
        dealerHand,
        phase: "play", // "insurance" | "play" | "resolved"
        insuranceBet: 0,
        insuranceMsg: "",
        peeked: false,
        cheatAttempted: false,
        banner: ""
    };
    const s = wagon.saloonState;

    // Lock in the wager and the deck's shuffle order immediately — no
    // free re-deal by refreshing before you see how the hand plays out.
    persistGamblingState();

    const playerBJ = blackjackHandValue(playerCards) === 21;
    const dealerShowsAce = dealerHand[0].rank === "A";

    if (dealerShowsAce && wagon.money >= wager / 2) {
        // Insurance is offered before anything else resolves — even a
        // player natural (standard rules: you may insure your blackjack).
        s.phase = "insurance";
        renderBlackjackUI();
        return;
    }

    // No insurance decision needed. Naturals resolve immediately.
    if (playerBJ || blackjackHandValue(dealerHand) === 21) {
        settleBlackjack();
        return;
    }
    renderBlackjackUI();
}

function blackjackInsurance(buy) {
    const s = wagon.saloonState;
    if (!s || s.game !== "blackjack" || s.phase !== "insurance") return;

    if (buy) {
        const cost = s.baseWager / 2;
        if (wagon.money < cost) { updateActionPrompt("You can't cover the insurance."); return; }
        wagon.money -= cost;
        s.insuranceBet = cost;
    }
    s.phase = "play";

    const dealerBJ = blackjackHandValue(s.dealerHand) === 21;
    if (dealerBJ) {
        if (s.insuranceBet > 0) {
            wagon.money += s.insuranceBet * 3; // 2:1 payout plus the stake back
            s.insuranceMsg = `Insurance pays 2:1 — you collect $${(s.insuranceBet * 2).toFixed(2)}.`;
        } else {
            s.insuranceMsg = "You waved off the insurance. The dealer smiles.";
        }
        settleBlackjack();
        return;
    }

    s.insuranceMsg = s.insuranceBet > 0
        ? `No blackjack under there. Your $${s.insuranceBet.toFixed(2)} insurance vanishes into the felt.`
        : "No blackjack under there. Good instinct skipping the insurance.";
    persistGamblingState();

    // A player natural still resolves immediately once insurance is settled.
    if (blackjackHandValue(s.hands[0].cards) === 21 && s.hands[0].cards.length === 2) {
        settleBlackjack();
        return;
    }
    renderBlackjackUI();
}

function activeBlackjackHand() {
    const s = wagon.saloonState;
    if (!s || s.game !== "blackjack") return null;
    return s.hands[s.active] || null;
}

function blackjackCanSplit() {
    const s = wagon.saloonState;
    const h = activeBlackjackHand();
    return s && s.phase === "play" && s.hands.length === 1 && h && !h.done &&
        h.cards.length === 2 && h.cards[0].rank === h.cards[1].rank &&
        wagon.money >= s.baseWager;
}

function blackjackCanDouble() {
    const s = wagon.saloonState;
    const h = activeBlackjackHand();
    return s && s.phase === "play" && h && !h.done && h.cards.length === 2 && wagon.money >= h.wager;
}

function blackjackHit() {
    const s = wagon.saloonState;
    const h = activeBlackjackHand();
    if (!s || s.phase !== "play" || !h || h.done) return;
    h.cards.push(s.deck.pop());
    if (blackjackHandValue(h.cards) >= 21) {
        h.done = true;
        blackjackAdvance();
    } else {
        renderBlackjackUI();
    }
}

function blackjackStand() {
    const s = wagon.saloonState;
    const h = activeBlackjackHand();
    if (!s || s.phase !== "play" || !h || h.done) return;
    h.done = true;
    blackjackAdvance();
}

function blackjackDouble() {
    const s = wagon.saloonState;
    const h = activeBlackjackHand();
    if (!blackjackCanDouble()) return;
    wagon.money -= h.wager;
    h.wager *= 2;
    h.doubled = true;
    h.cards.push(s.deck.pop()); // one card, then you live with it
    h.done = true;
    persistGamblingState();
    blackjackAdvance();
}

function blackjackSplit() {
    const s = wagon.saloonState;
    if (!blackjackCanSplit()) return;
    const h = s.hands[0];
    wagon.money -= s.baseWager;
    s.hands = [
        { cards: [h.cards[0], s.deck.pop()], wager: s.baseWager, done: false, isSplit: true, doubled: false, outcome: null, resultMsg: "" },
        { cards: [h.cards[1], s.deck.pop()], wager: s.baseWager, done: false, isSplit: true, doubled: false, outcome: null, resultMsg: "" },
    ];
    s.active = 0;
    persistGamblingState();
    renderBlackjackUI();
}

// Move to the next unplayed hand, or hand the round to the dealer.
function blackjackAdvance() {
    const s = wagon.saloonState;
    const nextIdx = s.hands.findIndex(h => !h.done);
    if (nextIdx !== -1) {
        s.active = nextIdx;
        renderBlackjackUI();
        return;
    }
    // Dealer only draws if at least one hand is still standing.
    const anyLive = s.hands.some(h => blackjackHandValue(h.cards) <= 21);
    if (anyLive) {
        while (blackjackHandValue(s.dealerHand) < 17) {
            s.dealerHand.push(s.deck.pop());
        }
    }
    settleBlackjack();
}

function settleBlackjack() {
    const s = wagon.saloonState;
    const dealerTotal = blackjackHandValue(s.dealerHand);
    const dealerBJ = dealerTotal === 21 && s.dealerHand.length === 2;
    let anyWin = false, anyLoss = false, biggestWinWager = 0;

    s.hands.forEach(h => {
        const total = blackjackHandValue(h.cards);
        // A natural only counts on an unsplit two-card 21 — split hands that
        // land 21 on two cards pay like a normal win (standard rule).
        const naturalBJ = total === 21 && h.cards.length === 2 && !h.isSplit;

        if (total > 21) {
            h.outcome = "lose";
            h.resultMsg = `Bust — $${h.wager} lost.`;
        } else if (dealerBJ && !naturalBJ) {
            h.outcome = "lose";
            h.resultMsg = `Dealer blackjack — $${h.wager} lost.`;
        } else if (naturalBJ && dealerBJ) {
            wagon.money += h.wager;
            h.outcome = "push";
            h.resultMsg = `Both blackjack — push, $${h.wager} back.`;
        } else if (naturalBJ) {
            wagon.money += h.wager * 3;
            h.outcome = "win";
            h.resultMsg = `Blackjack! Pays double — you win $${h.wager * 2}.`;
        } else if (dealerTotal > 21) {
            wagon.money += h.wager * 2;
            h.outcome = "win";
            h.resultMsg = `Dealer busts — you win $${h.wager}!`;
        } else if (total > dealerTotal) {
            wagon.money += h.wager * 2;
            h.outcome = "win";
            h.resultMsg = `${total} beats ${dealerTotal} — you win $${h.wager}!`;
        } else if (total < dealerTotal) {
            h.outcome = "lose";
            h.resultMsg = `${dealerTotal} beats ${total} — $${h.wager} lost.`;
        } else {
            wagon.money += h.wager;
            h.outcome = "push";
            h.resultMsg = `Push at ${total} — $${h.wager} back.`;
        }

        if (h.outcome === "win") { anyWin = true; biggestWinWager = Math.max(biggestWinWager, h.wager); }
        if (h.outcome === "lose") anyLoss = true;
    });

    wagon.money = Math.max(0, wagon.money);
    s.phase = "resolved";

    if (anyWin) {
        AudioManager.playSound('gold');
        if (biggestWinWager >= 50) AchievementManager.unlock('high_roller', 'High Roller');
    } else if (anyLoss) {
        AudioManager.playSound('miss');
    }

    persistGamblingState();
    textUpdateUI();
    renderBlackjackUI();
}

function renderBlackjackUI() {
    const s = wagon.saloonState;
    if (!s || s.game !== "blackjack") return;
    const content = modalChild;
    const resolved = s.phase === "resolved";

    const dealerCardsHtml = s.dealerHand.map((c, i) => {
        const showFace = resolved || i === 0 || s.peeked;
        return renderCard(c, !showFace);
    }).join('');
    const showDealerTotal = resolved || s.peeked;

    const handsHtml = s.hands.map((h, i) => {
        const total = blackjackHandValue(h.cards);
        const isActive = s.phase === "play" && i === s.active && !h.done;
        const label = s.hands.length > 1 ? `Hand ${i + 1}` : "Your Hand";
        const outcomeColor = h.outcome === 'win' ? '#00e676' : (h.outcome === 'push' ? '#ffd700' : '#ff6666');
        return `
            <div style="margin: 6px auto; padding: 6px; max-width: 90%; border: 2px ${isActive ? 'solid #ffd700' : 'solid transparent'}; border-radius: 8px;">
                <p style="color:#ccc; margin-bottom:2px;">${label} — $${h.wager}${h.doubled ? ' (doubled)' : ''}${isActive ? ' ◄ playing' : ''}</p>
                <div>${h.cards.map(c => renderCard(c, false)).join('')}</div>
                <p style="color:#ccc; font-size:0.9em;">Total: ${total}${total > 21 ? ' — BUST' : ''}</p>
                ${h.resultMsg ? `<p style="color:${outcomeColor}; font-weight:bold; margin:2px 0;">${translateSanity(h.resultMsg)}</p>` : ''}
            </div>
        `;
    }).join('');

    let buttonsHtml = "";
    if (s.phase === "insurance") {
        const cost = (s.baseWager / 2).toFixed(2);
        buttonsHtml = `
            <p style="color:#ffd700;">${translateSanity('The dealer shows an Ace. "Insurance, friend? Half your wager, pays 2-to-1 if I\'ve got it."')}</p>
            <div class="buttons">
                <button class="btn btn-warning" ${actionAttrs('blackjackInsurance', [true])}>Buy Insurance ($${cost})</button>
                <button class="btn btn-info" ${actionAttrs('blackjackInsurance', [false])}>No Insurance</button>
            </div>
        `;
    } else if (s.phase === "play") {
        buttonsHtml = `
            <div class="buttons">
                <button class="btn btn-info" ${actionAttrs('blackjackHit')}>Hit</button>
                <button class="btn btn-success" ${actionAttrs('blackjackStand')}>Stand</button>
                ${blackjackCanDouble() ? `<button class="btn btn-warning" ${actionAttrs('blackjackDouble')}>Double Down</button>` : ''}
                ${blackjackCanSplit() ? `<button class="btn btn-warning" ${actionAttrs('blackjackSplit')}>Split</button>` : ''}
                ${!s.cheatAttempted ? `<button class="btn btn-warning" ${actionAttrs('blackjackCheatPeek')}>🃏 Cheat: Peek at the Hole Card</button>` : ''}
            </div>
        `;
    } else {
        const canRematch = wagon.money >= GAMBLING_WAGER_TIERS[0] && !isSaloonBanned();
        buttonsHtml = `
            <div class="buttons">
                ${canRematch ? `<button class="btn btn-warning" ${actionAttrs('openBlackjackTable')}>Play Another Hand</button>` : ''}
                <button class="btn btn-success" ${actionAttrs('exitBlackjackTable')}>Leave Table</button>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="text-align:center; background:#0b3d24; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">♠ Blackjack — Wager $${s.baseWager}</h3>
            <p style="color:#ccc; margin-bottom:2px;">Dealer</p>
            <div>${dealerCardsHtml}</div>
            <p style="color:#ccc; font-size:0.9em;">${showDealerTotal ? `Total: ${blackjackHandValue(s.dealerHand)}` : '&nbsp;'}</p>
            ${s.insuranceMsg ? `<p style="color:#ffd700; font-size:0.9em;">${translateSanity(s.insuranceMsg)}</p>` : ''}
            <hr style="border-color:#8b5a2b;">
            ${handsHtml}
            ${s.banner ? `<p style="color:#ff6666; font-weight:bold;">${translateSanity(s.banner)}</p>` : ''}
            ${buttonsHtml}
        </div>
    `;
}

function blackjackCheatPeek() {
    const s = wagon.saloonState;
    if (!s || s.game !== "blackjack" || s.phase !== "play" || s.cheatAttempted) return;
    s.cheatAttempted = true;
    adjustKarma(-8); // the attempt costs you something whether or not you're caught

    if (gamblingRandom() < cheatCatchChance()) {
        AudioManager.playSound('alert');
        adjustKarma(-7);
        const totalStaked = s.hands.reduce((sum, h) => sum + h.wager, 0);
        const fine = Math.min(wagon.money, s.baseWager);
        wagon.money = Math.max(0, wagon.money - fine);
        banFromSaloon();
        s.phase = "resolved";
        s.hands.forEach(h => { h.outcome = "lose"; h.resultMsg = ""; });
        s.banner = `The dealer grabs your wrist. "Saw that." Your $${totalStaked} on the table is gone, plus a $${fine.toFixed(2)} fine — and you're thrown out.`;
        AchievementManager.unlock('caught_cheating', 'Caught Red-Handed');
        persistGamblingState();
        textUpdateUI();
        renderBlackjackUI();
        return;
    }

    s.peeked = true;
    AudioManager.playSound('trade');
    renderBlackjackUI();
}

function exitBlackjackTable() {
    wagon.saloonState = null;
    openSaloon();
}

// ---------- Liar's Dice ----------

function npcGenerateOpeningBid(npcDice) {
    let bestFace = 2, bestExpected = -1;
    for (let f = 1; f <= 6; f++) {
        const own = countDiceForFace(npcDice, f);
        const expected = own + 5 * (f === 1 ? (1 / 6) : (2 / 6)); // 5 unknown dice in the player's hand
        if (expected > bestExpected) { bestExpected = expected; bestFace = f; }
    }
    let qty = Math.max(1, Math.round(bestExpected));
    if (gamblingRandom() < 0.35) qty += 1; // the occasional opening bluff
    return { qty, face: bestFace };
}

function generateRaiseOptions(bid) {
    const options = [];
    options.push({ qty: bid.qty + 1, face: bid.face });
    if (bid.face < 6) {
        options.push({ qty: bid.qty, face: bid.face + 1 });
        options.push({ qty: bid.qty + 1, face: Math.min(6, bid.face + 2) });
    } else {
        options.push({ qty: bid.qty + 2, face: bid.face });
        options.push({ qty: bid.qty + 1, face: 1 }); // qty alone makes this a valid raise
    }
    const seen = new Set();
    return options.filter(o => {
        const key = `${o.qty}-${o.face}`;
        if (seen.has(key) || o.qty > 10) return false;
        seen.add(key);
        return true;
    });
}

function openDiceTable() {
    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">🎲 Liar's Dice</h3>
            <p style="font-size:0.9em; color:#ddd;">${translateSanity('The old-timer rattles his cup. "Five dice each, hidden under the cup. Bid on what\'s showing across both hands — aces are wild. Call me a liar if you don\'t believe it. You\'d better be right."')}</p>
            <p style="color:#aaa; font-size:0.85em;">You have $${wagon.money.toFixed(2)}.</p>
            ${renderWagerButtons('startLiarsDice')}
            <div class="buttons" style="margin-top:10px;"><button class="btn btn-danger" ${actionAttrs('openSaloon')}>Back</button></div>
        </div>
    `;
}

function startLiarsDice(wager) {
    if (wagon.money < wager || isSaloonBanned() || gamblingBlocked()) { updateActionPrompt("You can't cover that bet."); return; }
    wagon.money -= wager;

    const playerDice = [rollDie(), rollDie(), rollDie(), rollDie(), rollDie()];
    const npcDice = [rollDie(), rollDie(), rollDie(), rollDie(), rollDie()];
    const opening = npcGenerateOpeningBid(npcDice);

    wagon.saloonState = {
        game: "dice",
        wager,
        playerDice,
        npcDice,
        currentBid: { qty: opening.qty, face: opening.face, by: 'npc' },
        round: 1,
        cheatUsed: false,
        peekedCount: null,
        waitingForNpc: false,
        resolved: false,
        outcome: null,
        resultMsg: ""
    };
    persistGamblingState();
    renderLiarsDiceUI();
}

function renderLiarsDiceUI() {
    const s = wagon.saloonState;
    if (!s || s.game !== "dice") return;
    const content = modalChild;

    const playerDiceHtml = s.playerDice.map(d => renderDie(d)).join('');
    const bidText = `${s.currentBid.qty} × ${renderDieMini(s.currentBid.face)}`;

    let buttonsHtml = "";
    if (s.resolved) {
        const revealHtml = s.npcDice.map(d => renderDie(d)).join('');
        const canRematch = wagon.money >= GAMBLING_WAGER_TIERS[0] && !isSaloonBanned();
        buttonsHtml = `
            <p style="color:#ccc;">His dice: ${revealHtml}</p>
            <div class="buttons">
                ${canRematch ? `<button class="btn btn-warning" ${actionAttrs('openDiceTable')}>Play Another Round</button>` : ''}
                <button class="btn btn-success" ${actionAttrs('exitLiarsDiceTable')}>Leave Table</button>
            </div>
        `;
    } else if (s.waitingForNpc) {
        buttonsHtml = `<p style="color:#aaa; font-style:italic;">He chews on his toothpick, studying his cup...</p>`;
    } else {
        const options = generateRaiseOptions(s.currentBid);
        buttonsHtml = `
            <div class="buttons">
                <button class="btn btn-danger" ${actionAttrs('liarsDiceCallLiar')}>Call Liar!</button>
                ${options.map(o => `<button class="btn btn-info" ${actionAttrs('liarsDiceRaise', [o.qty, o.face])}>Raise: ${o.qty} × ${renderDieMini(o.face)}</button>`).join('')}
                ${!s.cheatUsed ? `<button class="btn btn-warning" ${actionAttrs('liarsDiceCheat')}>👁️ Cheat: Read the Table</button>` : ''}
            </div>
        `;
    }

    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">🎲 Liar's Dice — Wager $${s.wager}</h3>
            <p style="color:#ccc;">Your dice (1s are wild):</p>
            <div>${playerDiceHtml}</div>
            <hr style="border-color:#8b5a2b;">
            <p style="color:#fff; font-size:1.1em;">Current bid: <strong>${bidText}</strong> ${s.currentBid.by === 'npc' ? '(his claim)' : '(your claim)'}</p>
            ${typeof s.peekedCount === "number" ? `<p style="color:#ffd700;">You happen to know the real count is ${s.peekedCount}.</p>` : ''}
            ${s.resultMsg ? `<p style="color:${s.outcome === 'win' ? '#00e676' : '#ff6666'}; font-weight:bold;">${s.resultMsg}</p>` : ''}
            ${buttonsHtml}
        </div>
    `;
}

function liarsDiceRaise(qty, face) {
    const s = wagon.saloonState;
    if (!s || s.game !== "dice" || s.resolved || s.waitingForNpc || s.currentBid.by !== 'npc') return;
    s.currentBid = { qty, face, by: 'player' };
    s.round = (s.round || 1) + 1;
    s.peekedCount = null;
    s.waitingForNpc = true;
    renderLiarsDiceUI();
    setTimeout(() => {
        s.waitingForNpc = false;
        npcRespondToBid();
    }, 1100);
}

function npcRespondToBid() {
    const s = wagon.saloonState;
    if (!s || s.game !== "dice" || s.resolved) return;

    const bid = s.currentBid;
    const ownMatches = countDiceForFace(s.npcDice, bid.face);
    const perDieProb = bid.face === 1 ? (1 / 6) : (2 / 6);
    const expected = ownMatches + 5 * perDieProb; // 5 unknown dice in the player's hand
    const bluffFactor = 0.5 + gamblingRandom() * 0.5;

    if (s.round >= 4 || bid.qty > expected * 1.4 * bluffFactor) {
        resolveLiarsDiceRound(bid, 'npc');
    } else {
        const options = generateRaiseOptions(bid);
        if (options.length === 0) {
            // Already at the maximum possible bid (10 of a kind) — nowhere
            // higher to go, so the only honest move is to call it.
            resolveLiarsDiceRound(bid, 'npc');
            return;
        }
        const choice = options[gamblingRandomInt(options.length)];
        s.currentBid = { qty: choice.qty, face: choice.face, by: 'npc' };
        s.round = (s.round || 1) + 1;
        renderLiarsDiceUI();
    }
}

function liarsDiceCallLiar() {
    const s = wagon.saloonState;
    if (!s || s.game !== "dice" || s.resolved || s.waitingForNpc || s.currentBid.by !== 'npc') return;
    resolveLiarsDiceRound(s.currentBid, 'player');
}

function resolveLiarsDiceRound(disputedBid, calledBy) {
    const s = wagon.saloonState;
    const allDice = [...s.playerDice, ...s.npcDice];
    const actualCount = countDiceForFace(allDice, disputedBid.face);
    const bidWasTrue = actualCount >= disputedBid.qty;

    // If the player called it, they win when the bid turns out to be a lie.
    // If the NPC called it (on the player's own bid), the player wins when
    // the bid turns out to be true — the NPC blinked for nothing.
    const playerWins = calledBy === 'player' ? !bidWasTrue : bidWasTrue;

    s.resolved = true;
    s.outcome = playerWins ? "win" : "lose";

    const verdict = `${disputedBid.qty} × ${renderDieMini(disputedBid.face)} — actual count was ${actualCount}, the bid was ${bidWasTrue ? "true" : "a lie"}.`;

    // Plain-language verdict for the speech engine (the on-screen version
    // embeds HTML die chips, which don't read aloud well).
    const faceWords = ["", "ones", "twos", "threes", "fours", "fives", "sixes"];
    const spokenVerdict = `${disputedBid.qty} ${faceWords[disputedBid.face]} — actual count was ${actualCount}, the bid was ${bidWasTrue ? "true" : "a lie"}.`;

    if (playerWins) {
        wagon.money += s.wager * 2;
        AudioManager.playSound('gold');
        s.resultMsg = `${calledBy === 'player' ? "You called it right." : "He blinked first."} ${verdict} You win $${s.wager}!`;
        speakHint(`${calledBy === 'player' ? "You called it right." : "He blinked first."} ${spokenVerdict} You win $${s.wager}!`);
    } else {
        AudioManager.playSound('miss');
        s.resultMsg = `${calledBy === 'player' ? "You called it wrong." : "He called your bluff."} ${verdict} You lose your $${s.wager} wager.`;
        speakHint(`${calledBy === 'player' ? "You called it wrong." : "He called your bluff."} ${spokenVerdict} You lose your $${s.wager} wager.`);
    }

    wagon.money = Math.max(0, wagon.money);
    persistGamblingState();
    textUpdateUI();
    renderLiarsDiceUI();
}

function liarsDiceCheat() {
    const s = wagon.saloonState;
    if (!s || s.game !== "dice" || s.resolved || s.waitingForNpc || s.cheatUsed || s.currentBid.by !== 'npc') return;
    s.cheatUsed = true;
    adjustKarma(-8);

    if (gamblingRandom() < cheatCatchChance()) {
        AudioManager.playSound('alert');
        adjustKarma(-7);
        const fine = Math.min(wagon.money, s.wager);
        wagon.money = Math.max(0, wagon.money - fine);
        banFromSaloon();
        s.resolved = true;
        s.outcome = "lose";
        s.resultMsg = `The old-timer catches you eyeballing his cup. "Cheat!" the whole bar turns to look. Your $${s.wager} wager is gone, plus a $${fine.toFixed(2)} fine — and you're not welcome back.`;
        AchievementManager.unlock('caught_cheating', 'Caught Red-Handed');
        persistGamblingState();
        textUpdateUI();
        renderLiarsDiceUI();
        return;
    }

    const allDice = [...s.playerDice, ...s.npcDice];
    s.peekedCount = countDiceForFace(allDice, s.currentBid.face);
    AudioManager.playSound('trade');
    renderLiarsDiceUI();
}

function exitLiarsDiceTable() {
    wagon.saloonState = null;
    openSaloon();
}

const INSULT_DUEL_PAIRS = [
    { insult: "I've spoken with coyotes more polite than you.", comeback: "I'm glad to hear you attended your family reunion." },
    { insult: "Your wagon's held together with spit and prayers.", comeback: "Still sturdier than your marriage." },
    { insult: "I've seen oxen with better table manners.", comeback: "Funny — your mother taught them everything they know." },
    { insult: "You couldn't hit water if you fell out of a raft.", comeback: "And you couldn't float in it, with that head full of rocks." },
    { insult: "You smell like a buffalo three days dead.", comeback: "Better three days dead than twenty years talking and still brain-dead." },
    { insult: "My grandmother drives a wagon faster than you.", comeback: "Sure — anybody would, fleeing from your face." },
    { insult: "You've got the aim of a blind prospector.", comeback: "I've struck gold every time I aimed at your ego." },
    { insult: "They call you the slowest draw west of the Missouri.", comeback: "Only because I'm dragging your reputation behind me." },
	{ insult: "People fall at my feet when they see me coming!", comeback: "Even BEFORE they smell your breath?" },
	{ insult: "I'm not going to take your insolence sitting down!", comeback: "Your hemorrhoids are flaring up again eh?" },
	{ insult: "I once owned a dog that was smarter than you.", comeback: "He must have taught you everything you know." },
	{ insult: "Have you stopped wearing diapers yet?", comeback: "Why? Did you want to borrow one?" },
	{ insult: "There are no words for how disgusting you are.", comeback: "Yes, there are. You just never learned them." },
	{ insult: "I've heard you are a terrible pioneer", comeback: "Too bad no one's ever heard of YOU at all." },
	{ insult: "You make me want to puke.", comeback: "You make me think somebody already did." },
	{ insult: "You're as repulsive as a prairie dog in a negligee.", comeback: "I look THAT much like your fiancée?" },
	{ insult: "When your father first saw you, he must have been mortified!", comeback: "At least mine can be identified." },
	{ insult: "Throughout the plains, my great deeds are celebrated!", comeback: "Too bad they're all fabricated." },
    { insult: "You couldn't track a wounded bison through three feet of fresh snow!", comeback: "And yet, I easily followed the yellow streak running down your back." },
    { insult: "Your hunting skills are so poor, you'd starve in a slaughterhouse!", comeback: "At least I wouldn't be mistaken for the livestock, like you." },
    { insult: "The only thing you'll ever catch with a fishing rod is a severe cold!", comeback: "And the only thing you'll catch with that mouth is a swarm of bluebottles." },
    { insult: "You've spent the whole trail panning for gold and only found fools' gold!", comeback: "Which is still a sight more valuable than a single word from a fool like you." },
    { insult: "I wouldn't trust you to gather wild berries for a starving hog!", comeback: "Lucky for you, I specialize in rooting out completely useless weeds." },
    { insult: "Your carpentry skills would turn a perfectly good axle into a triangle!", comeback: "At least a triangle has three sharp points—which is three more than your argument." },
    { insult: "You'd manage to get lost navigating a completely straight, one-way trail!", comeback: "Anyone would leave the trail to avoid your face." },
    { insult: "You're the kind of greenhorn who'd trade a healthy team of oxen for a crusty sock!", comeback: "I'd still come out ahead on that trade compared to wasting daylight talking to you." },
    { insult: "Your medical remedies are a worse curse on this party than double dysentery!", comeback: "Then you'd best step back, before I decide you're a symptom that needs removing." },
    { insult: "I noticed the oxen completely refuse to pull the wagon whenever you speak!", comeback: "They're just waiting patiently for you to get out of the way so they don't trample a fool." },
    { insult: "Those trail rags look like they were stitched together by a blind mountain badger!", comeback: "They're still high fashion compared to that birthday suit you call a face." },
    { insult: "You've contributed absolutely nothing to this wagon company's survival!", comeback: "I kept you alive this long, didn't I? I call that a miracle of logistics." },
    { insult: "I'd rather eat my own leather boots than eat your cooking!", comeback: "I was just wishing you spent more time chewing and less time talking." },
    { insult: "The crows are already circling your camp, just waiting for you to drop!", comeback: "They're probably just mistaking your constant whining for a dying calf." },
    {  insult: "You wouldn't know a gold nugget if it fell from the sky and cracked your skull!", comeback: "Lucky for me, your head is empty enough to cushion the blow." },
    { insult: "Your pockets are as empty as a dry creek bed in the Great Basin!", comeback: "They'll fill up fast once I start charging you a toll for being completely insufferable." },
    { insult: "Your wagon tongue is split, warped, and entirely rotten!", comeback: "Which makes it an identical match to the tongue in your mouth." },
    { insult: "You handle that wagon like a drunken sailor piloting a wheelbarrow!", comeback: "And you follow behind it like a stray dog looking for table scraps." },
    { insult: "You look like you're in the final, agonizing stages of Bieber Fever!", comeback: "Then I suggest you step back before you find out if it's contagious." },
    { insult: "I've seen leeches with a more pleasant bedside manner than you!", comeback: "Funny, because I was just about to apply a few to draw the hot air out of your brain." },
    { insult: "Your trail trousers are so poorly stitched they're practically indecent!", comeback: "Then cover your eyes, unless you want a free preview of my premium content." },
    { insult: "You couldn't coax a hungry ox to a patch of fresh prairie clover!", comeback: "No, but I can clearly coax a giant jackass into a shouting match." },
];

function openInsultDuelTable() {
    if (wagon.flags[`duelChampion_${wagon.currentLandmark}`]) { openSaloon(); return; }
    const content = modalChild;
    const streak = wagon.flags[`duelStreak_${wagon.currentLandmark}`] || 0;
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">🗯️ Insult Dueling</h3>
            <p style="font-size:0.9em; color:#ddd;">${translateSanity('A scarred drover cracks his knuckles. "Three exchanges. Sharpest tongue takes the pot. Try to keep up."')}</p>
            ${hasSkill("Trade") ? `<p style="font-size:0.85em; color:#ffd700;">Your Trade instincts read the room — one bad retort will be ruled out each round.</p>` : ''}
            ${streak > 0 ? `<p style="font-size:0.85em; color:#00e676;">Win streak here: ${streak} — ${3 - streak} more and nobody in this saloon will face you again.</p>` : ''}
            <p style="color:#aaa; font-size:0.85em;">You have $${wagon.money.toFixed(2)}.</p>
            ${renderWagerButtons('startInsultDuel', INSULT_DUEL_WAGER_TIERS)}
            <div class="buttons" style="margin-top:10px;"><button class="btn btn-danger" ${actionAttrs('openSaloon')}>Back</button></div>
        </div>
    `;
}

function startInsultDuel(wager) {
    if (wagon.money < wager || isSaloonBanned() || gamblingBlocked() || wagon.flags[`duelChampion_${wagon.currentLandmark}`]) {
        updateActionPrompt("You can't cover that bet."); return;
    }
    wagon.money -= wager;

    // Seeded selection: three distinct insults, plus per-round distractors,
    // all drawn from the gambling RNG — reloading a save replays the same duel.
    const indices = [];
    while (indices.length < 3) {
        const i = gamblingRandomInt(INSULT_DUEL_PAIRS.length);
        if (!indices.includes(i)) indices.push(i);
    }

    wagon.saloonState = {
        game: "duel",
        wager,
        rounds: indices,
        roundIdx: 0,
        score: 0,
        npcScore: 0,
    };
    persistGamblingState();
    textUpdateUI();
    playInsultDuelRound();
}

function playInsultDuelRound() {
    const s = wagon.saloonState;
    if (!s || s.game !== "duel") return;

    const pairIdx = s.rounds[s.roundIdx];
    const pair = INSULT_DUEL_PAIRS[pairIdx];

    // Distractors are genuine comebacks to OTHER insults.
    const distractorPool = INSULT_DUEL_PAIRS
        .map((p, i) => i)
        .filter(i => i !== pairIdx && !s.rounds.slice(0, s.roundIdx).includes(i));
    const distractors = [];
    const distractorCount = hasSkill("Trade") ? 1 : 2; // Trade rules one out
    while (distractors.length < distractorCount && distractorPool.length > 0) {
        const pick = distractorPool.splice(gamblingRandomInt(distractorPool.length), 1)[0];
        distractors.push(INSULT_DUEL_PAIRS[pick].comeback);
    }

    // Shuffle correct comeback among the distractors (seeded)
    const options = [{ text: pair.comeback, correct: true }]
        .concat(distractors.map(d => ({ text: d, correct: false })));
    for (let i = options.length - 1; i > 0; i--) {
        const j = gamblingRandomInt(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
    }

    const choices = options.map(opt => ({
        text: translateSanity(opt.text),
        noResultScreen: true,
        action: () => resolveInsultDuelRound(opt.correct),
    }));

    triggerChoiceEvent({
        title: `Insult Duel — Round ${s.roundIdx + 1} of 3 (You ${s.score} : ${s.npcScore} Him)`,
        message: `${translateSanity(`The drover leans in and sneers:`)}<br><em style="color:#ffd700;">"${translateSanity(pair.insult)}"</em>`,
        choices,
    });
}

function resolveInsultDuelRound(wasCorrect) {
    const s = wagon.saloonState;
    if (!s || s.game !== "duel") return;

    if (wasCorrect) {
        s.score++;
        AudioManager.playSound('gold');
    } else {
        s.npcScore++;
        AudioManager.playSound('miss');
    }
    s.roundIdx++;

    if (s.roundIdx < 3) {
        playInsultDuelRound();
        return;
    }

    // Duel over — settle the pot and the streak
    const streakKey = `duelStreak_${wagon.currentLandmark}`;
    const won = s.score > s.npcScore;
    let outcomeMsg;
    if (won) {
        wagon.money += s.wager * 2;
        wagon.sanity = Math.min(100, wagon.sanity + 5);
        wagon.flags[streakKey] = (wagon.flags[streakKey] || 0) + 1;
        AudioManager.playSound('gold');
        outcomeMsg = `The drover named Terry storms off to a chorus of laughter. You were dissin' Terry. You take the pot — $${s.wager} richer and feeling sharp. (+5 Sanity)`;
        if (wagon.flags[streakKey] >= 3) {
            wagon.flags[`duelChampion_${wagon.currentLandmark}`] = true;
            AchievementManager.unlock('silver_tongue', 'Silver Tongue');
            outcomeMsg += " Word spreads fast — nobody in this saloon will duel you again.";
        }
    } else {
        wagon.flags[streakKey] = 0;
        AudioManager.playSound('miss');
        outcomeMsg = `The crowd winces on your behalf. The drover pockets your $${s.wager} and buys a round with it.`;
    }

    wagon.saloonState = null;
    persistGamblingState();
    textUpdateUI();

    const canRematch = wagon.money >= INSULT_DUEL_WAGER_TIERS[0] && !wagon.flags[`duelChampion_${wagon.currentLandmark}`];
    const content = modalChild;
    content.innerHTML = `
        <div style="text-align:center; background:#1a1005; color:#fff; padding:24px; border:4px solid #8b5a2b; font-family:'Courier New';">
            <h3 style="color:#ffd700;">🗯️ Duel ${won ? "Won" : "Lost"} — ${won ? "You" : "He"} took it ${Math.max(s.score, s.npcScore)} to ${Math.min(s.score, s.npcScore)}</h3>
            <p style="color:${won ? '#00e676' : '#ff6666'};">${translateSanity(outcomeMsg)}</p>
            <div class="buttons">
                ${canRematch ? `<button class="btn btn-warning" ${actionAttrs('openInsultDuelTable')}>Duel Again</button>` : ''}
                <button class="btn btn-success" ${actionAttrs('openSaloon')}>Back to Saloon</button>
            </div>
        </div>
    `;
    if (eventLog) eventLog.insertAdjacentHTML('afterbegin', `${outcomeMsg}<br>`);
}

function resolveGatheringStage() {
    const s = wagon.gatheringState;
    const resourceKey = s.stageOrder[s.stageIndex];
    const info = GATHER_RESOURCE_INFO[resourceKey];

    const baseYield = info.yieldMin + Math.random() * (info.yieldMax - info.yieldMin);
    const critBonus = Math.min(s.critCount || 0, 3);
    const totalYield = Math.max(1, Math.round((baseYield + critBonus) * (s.yieldMult || 1.0)));

    wagon.resources[resourceKey] += totalYield;
    s.sessionGains[resourceKey] = (s.sessionGains[resourceKey] || 0) + totalYield;

    s.stageIndex++;
    s.critCount = 0;

    if (s.stageIndex < s.stageOrder.length) {
        const nextResource = s.stageOrder[s.stageIndex];
        const nextInfo = GATHER_RESOURCE_INFO[nextResource];
        s.stage = nextInfo.stageName;
        s.clicks = 0;
        s.required = computeGatherRequiredClicks(nextResource);
        updateCraftingMessage(translateSanity(`You gathered ${totalYield} ${resourceKey}. Now: ${nextInfo.stageName}.`));
        renderGatheringUI();
        return;
    }

    wagon.sanity = Math.min(100, wagon.sanity + 2);
    const tally = Object.entries(s.sessionGains).map(([k, v]) => `${Math.round(v)} ${k}`).join(', ');
    AchievementManager.unlock('full_harvest', 'Full Harvest');
    updateCraftingMessage(translateSanity(`A full day's haul: ${tally}. You feel productive. (+2 Sanity)`));
    textUpdateUI();

    if (hasSkill("Repair") || wagon.isGamer) {
        openCraftingInterface();
    } else {
        // The full Troggle experience: clear the muncher board to prove your
        // pioneer intellect and unlock the crafting bench.
        startMuncherChallenge({
            title: "NUMBER MUNCHER LOCK!",
            subtitle: "INVENT THE WHEEL: only the numerate may craft.",
            onWin: () => {
                updateCraftingMessage("Logic accepted. You have successfully reinvented the wheel.");
                openCraftingInterface();
            },
            onLose: () => {
                wagon.sanity = Math.max(0, wagon.sanity - 10);
                textUpdateUI();
                modalChild.innerHTML = `
                    <div style="text-align:center; padding:20px; color:red;">
                        <h3>INVENTION FAILED</h3>
                        <p>The Troggle eats your incorrect logic! You feel significantly stupider. (-10 Sanity)</p>
                        <button ${actionAttrs('finalizeCraftingDay')} class="btn btn-danger">Hang Your Head in Shame</button>
                    </div>
                `;
            }
        });
    }
}


function applyZalgo(text) {
    const up = /[\u0300-\u036f]/g; // Combining Diacritical Marks
    const down = /[\u1dc0-\u1dff]/g; // Combining Diacritical Marks Supplement
    
    // Character sets for the glitch
    const soul = {
        up: ['\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u1dc4', '\u1dc5', '\u1dc6', '\u1dc7'],
        down: ['\u0316', '\u0317', '\u035a', '\u035b', '\u0339', '\u033a', '\u033b', '\u0345', '\u0347', '\u0348', '\u0349']
    };

    return text.split('').map(char => {
        let glitched = char;
        // Add 2-4 random marks above and below each letter
        for (let i = 0; i < 3; i++) {
            glitched += soul.up[Math.floor(Math.random() * soul.up.length)];
            glitched += soul.down[Math.floor(Math.random() * soul.down.length)];
        }
        return glitched;
    }).join('');
}

const GIBBERISH_MAP = {
    "animal": ["furry-meat-sack", "not-person", "critter-thingy", "maminal", "tasty-pet", "Texture-Wrapped-Meat", "NPC (Non-Person-Critter)", "Ambiguity-Mammal", "Walking-Exp-Point", "Organic-Loot-Container", "Perfectly Normal Beast",],
    "barrel": ["Cylindrical-Inventory-Slot", "Round-Storage-Boi", "Donkey-Kong-Ammo", "Liquid-Loot-Crate", "Thirst-Insurance-Container"],
    "barrels": ["Cylindrical-Inventory-Slots", "Round-Storage-Bois", "Donkey-Kong-Ammo-Stockpile", "Liquid-Loot-Crates", "Thirst-Insurance-Containers"],
    "Bigfoot": ["Brown-Yeti", "Hairy Creature", "Secret-Forest-Lover", "Hairy-Hide-and-Seek-Champ", "Stupid-Sexy-Ape", "Render-Error-Ape", "Low-Poly-Cryptid", "Social-Distancing-God", "The-Glitched-Grizzly", "Unconfirmed-Asset"],
    "book": ["Paper-DLC", "Word-Brick", "Analog-Wikipedia", "Tree-Based-Content", "Offline-Scrolling-Device", "Kindling-in-Waiting"],
    "books": ["Paper-DLCs", "Word-Bricks", "Analog-Wikipedias", "Tree-Based-Content-Packs", "Offline-Scrolling-Devices", "Kindling-in-Waiting"],
    "brothel": ["Love Shack", "Slip it Inn", "Cum 'n Go", "Open d’Hore", "Layflower", "Kindling-in-Waiting"],
    "bullet": ["wireless hole punch", "spicy-metal-balls", "long-range-unaliver", "gun-food", "lead-insertion", "Collision-Detection-Seed", "Point-and-Click-Pebble", "Lead-Injection-Vector", "High-Velocity-Logic", "Instant-Distance-Closer"],
    "camp": ["Spawn-Point", "Save-Zone", "AFK-Area", "Respawn-Perimeter", "Tent-Based-Hub-World"],
    "campfire": ["Warmth-Emitter", "Cozy-Render-Point", "Marshmallow-Station", "Thermal-Morale-Generator", "The-Original-Screen-Time"],
    "clothing": ["naked remover", "part cover", "cloth skin", "unnudifier", "Texture-Overlay", "Modesty-Patch", "Armor-Class-1", "External-Skin-DLC", "Wearable-Pixels"],
    "comeback": ["Counter-Attack-Dialogue", "Riposte.exe", "Return-Fire-Words", "Uno-Reverse-Sentence"],
    "Cow": ["8-Bit Beef", "Boxy Moo-Moo", "Leather Cube", "Mobile Meat-Block", "Bull-ion Cube"],
    "coward": ["Combat-Logger", "Flee-Build", "Yellow-Belly-Class", "Alt-F4-Enthusiast"],
    "dairy": ["Moo-Juice-Industry", "Lactose-Sector", "Cow-Output", "Milk-Based-Economy"],
    "daytime": ["un-night", "domain of the sun", "temporal state 1", "undark time",],
    "desert": ["Sand-Level", "The-Hydration-Debuff-Zone", "Loading-Screen-Biome", "Nature's-Empty-Map", "The-Big-Beige"],
    "died": ["unalived", "cancelled their subscription to Life™", "updated their Facebook status to dead", "became worm food", "joined the undead faction", "failed a survive roll",],
    "dog": ["Good-Boy-Unit", "Bark-Module", "Fur-Missile", "Emotional-Support-DLC", "Loyalty-Sprite", "Wolf-Lite™", "Four-Legged-Morale-Patch"],
    "drover": ["cowpuncher", "buckaroo", "wrangler", "leather-daddy"],
    "duel": ["1v1-Me", "PvP-Invite", "Honor-Deathmatch", "Ranked-Match", "Turn-Based-Beef"],
    "dysentery": ["Brown-Screen-of-Death", "Logic-Leaking", "System-Flush", "Intestinal-Glitch"],
    "ego": ["Self-Buff", "Pride-Stat", "Main-Character-Syndrome", "Inflated-Hitbox"],
    "escape": ["Alt-F4-IRL", "Combat-Log", "Tactical-Bravely-Run", "Despawn-Technique", "Boundary-Break"],
    "escaped": ["Hit Alt-F4-IRL", "Combat-Logged-Out", "Tactical-Bravely-Ran", "Despawned", "Boundary-Broke"],
    "family": ["starter-party", "name-sharers", "very-close-roomates", "non-rent-payers"],
	"farmer": ["Crop-Grinder", "Dirt-Class-Main", "Agriculture-NPC", "Harvest-Bot", "Free-Range-Landlord"],
    "firewood": ["Thermal-Loot", "Pre-Fire", "Combustible-Content", "Heat-Ammo", "Flame-Batteries", "Burnable-Logs-of-Comfort"],
    "fishing": ["Loot-Slot-Machine", "Wet-Pokemon-Battle", "Underwater-Gacha", "The-Bait-Grind", "Sprite-Hooking"],
    "Food": ["Edible Assets", "Salty Graphics", "HP Paste", "Inventory Filler", "Mouth Input", "People Fuel", "Gussied-Up Raccoon Meat",],
    "fort": ["Safe-Zone-Hub", "Save-Point-Village", "The-Shop-Level", "Walled-Texture-Pack", "Cutscene-Location"],
    "gather": ["Minecrafting-the-Flora", "Resource-Grind", "Punch-to-Win", "Inventory-Padding", "Item-Farming"],
    "gold": ["Premium-Currency", "Shiny-Logic-Dust", "The-Winning-Score", "Trade-Tokens", "Bribe-Material", "Pay-to-Hopefully-Win",],
    "grandmother": ["Legacy-Unit", "Elder-NPC", "Retro-Mom", "Original-Save-File", "Tutorial-Ancestor"],
    "health": ["HP", "Hit-Points", "Meat-Integrity", "Un-Death-Percentage", "Body-Battery"],
    "hit": ["angry-touched", "spicy-poked", "mean-tickled",],
    "hunt": ["Tactical-Meat-Acquisition", "FPS-Mode", "Hitbox-Hunting", "Aggro-Management", "Loot-Drops-Live"],
    "hunting": ["Tactical-Meat-Acquisition", "FPS-Mode", "Hitbox-Hunting", "Aggro-Management", "Loot-Drops-Live"],
    "illness": ["anti-wellness", "heath-drainer", "rest-forcer", "sickness-unaliver", "computer virus, but like for a person",],
    "Independence": ["The Tutorial Map", "Missouri.exe", "Level 1-1", "Point of No Return"],
    "insult": ["Verbal-Damage", "Word-Attack", "Chat-Flame", "Dialogue-Debuff", "Trash-Talk-Projectile"],
    "insults": ["Verbal-Damage", "Word-Attacks", "Chat-Flames", "Dialogue-Debuffs", "Trash-Talk-Projectiles"],
    "landmark": ["Visual-Anchor", "Static-Mesh", "Point-of-Interest-Marker", "The-Rock-That-Doesn't-Move"],
    "lootbox": ["Gatcha Bullshit", "Whale Fooder", "Gambling for kids", "Microtrans-addictions"],
    "manners": ["Politeness-Firmware", "Social-Compliance-Patch", "Etiquette-DLC", "Courtesy-Subroutines"],
    "marriage": ["Co-op-Mode", "Permanent-Party-Invite", "Ring-Based-Contract", "Two-Player-Campaign", "Shared-Inventory-Agreement"],
    "medicine": ["Health-Potion", "HP-Juice", "Chemical-Cheat-Code", "Doctor-Sauce", "1848 Speedrun-Elixir", "Legally-Ambiguous-Syrup"],
    "morning": ["Daily-Reset", "Respawn-o'-Clock", "Sun-Boot-Sequence", "The-Loading-of-the-Day"],
    "night": ["Dark-Mode", "Low-Light-Render", "The-Scary-FPS-Drop", "Screen-Saver-Hours", "Unlit-Content"],
    "nudist": ["clothing-avoider", "junk shower", "taint-tanner", "exhibitionist",],
    "Oregon": ["Oregano Capitol", "The End-Game DLC", "Win-State", "Glory-Pixels", "Promised Land",],
    "ox": ["Wagon-Engines", "Four-Legged-Tractors", "Mobile-Steak-Batteries", "The-Hairy-Horsepower", "Bovine-Bio-Fuel"],
    "oxen": ["Wagon-Engines", "Four-Legged-Tractors", "Mobile-Steak-Batteries", "The-Hairy-Horsepower", "Bovine-Bio-Fuel"],
    "Pace": ["Clock-Speed", "Frame-Rate-of-Pain", "Temporal-Slider", "Difficulty-Setting", "Metabolic-Overclocking"],
    "panning": ["Micro-Transaction-Request", "Free-Gold-Glitch", "nature lootboxing", "shiny searching", "1848 crypto-mining",],
    "path": ["followy-thing", "1848 GPS directions", "destiny-determined-route", "linear bullshit", "unopen-world-railroading"],
    "prey": ["Target-Practice", "The-Soon-To-Be-Food", "Aggro-Target", "Meat-Pinata", "Despawn-Candidate"],
    "prospect": ["Micro-Transaction-Request", "Free-Gold-Glitch", "nature lootboxing", "shiny searching", "1848 crypto-mining",],
    "prospecting": ["Micro-Transaction-Request", "Free-Gold-Glitch", "nature lootboxing", "shiny searching", "1848 crypto-mining",],
    "prospector": ["Shiny-Seeker", "1848-Crypto-Bro", "Pan-Handler-Class", "Gold-Gacha-Addict"],
    "PUNCH": ["FIST-LOGIC", "DATA-STRIKE", "PIXEL-SMASH", "ERROR_01", "HAND KICK", "SPICY TOUCH"],
    "rain": ["Sky-Leakage", "Free-Sky-DLC", "Cloud-Sweat", "Falling-Sky-Particles", "Barrel-Filler-from-Above"],
    "Rations": ["Stamina-Bars", "Hunger-Meter-Fuel", "Boring-Salty-Energy", "The-Anti-Starve-Paste", "Minimum-Required-Pixels"],
    "reputation": ["Karma-Stat", "Social-Credit-Score", "Fame-Meter", "NPC-Opinion-Cache", "Street-Cred-Points"],
    "Reward": ["Lootbox", "Operant-Conditioning", "Treat",],
    "river": ["Liquid-Death-Wall", "Texture-Animation-Hole", "The-Drown-Simulator", "Physics-Engine-Trap", "Blue-Lava"],
    "sanity": ["Mental-HP", "Brain-Battery", "Vibe-Meter", "Psyche-Points", "Reality-Signal-Strength", "The-Stat-You're-Losing-Right-Now"],
    "snow": ["Cold-Confetti", "Frozen-Lag", "White-Pixel-Blizzard", "Sky-Dandruff", "Winter's-Loading-Screen"],
    "storm": ["Sky-Boss-Fight", "Sky-Tantrum", "Particle-Effect-Overload", "The-Server's-Bad-Day", "Atmospheric-Rage-Quit"],
    "telegram": ["paper-text-message", "physical-notification", "1848-SMS"],
    "telegraph": ["texty-machine", "clickety-clack-machine", "message-sendy-thing", "1848-SMS"],
    "thief": ["Inventory-Redistributor", "Stealth-Class-Player", "Unauthorized-Loot-Transfer-Agent", "Rogue-Main", "Free-Market-Enthusiast"],
    "thieves": ["Inventory-Redistributors", "Stealth-Class-Players", "Unauthorized-Loot-Transfer-Agents", "Rogue-Mains", "Free-Market-Enthusiasts"],
    "trail": ["followy-thing", "1848 GPS directions", "destiny-determined-route", "linear bullshit", "unopen-world-railroading"],
    "ugly": ["fugly", "funky-looking", "hit-with-the-ugly-stick", "facially=challenged", "unpretty"],
    "wagon": ["mobile-hut", "people-mover", "1848-RV", "shitty-temp-home", "oxen burden"],
    "water": ["Hydration-Juice", "Sky-Soup", "Un-Dirt", "Liquid-HP", "Thirst-Deleter", "H2-Whoa", "Wet-Content"],
    "weather": ["Skybox-Mood-Swings", "Environmental-Particle-Effects", "The-RNG-Sky", "Atmospheric-Debuff", "Climate-Glitch"],
    "Wheel": ["Round Square", "Bus-Go-Rounder", "Rotating Geometry", "Turny-Thingy", "Not-Triangle", "Smooth Boy", "Circular-Physics-Glitch", "Infinite-Roll-Triangle", "Gravity-Defying-Hoop", "The-Thing-That-Jesus-Takes", "Rolling-Prop"],
    "Wood": ["Brown Pixels", "Tree-Slab", "Vertical Dirt", "Muncher Bait", "Tree Meat"],
};

// Precompiled once: {word, regex, options} for every entry above. Built a single time
// at script load instead of on every translateSanity() call.
const GIBBERISH_ENTRIES = Object.keys(GIBBERISH_MAP).map(word => ({
    word,
    regex: new RegExp(`\\b${word}\\b`, 'gi'),
    options: GIBBERISH_MAP[word]
}));

function translateSanity(text) {
    let result = text;
    if (wagon.sanity < 60) {
		const intensity = (1 - wagon.sanity / 100);
	
		for (const { regex, options } of GIBBERISH_ENTRIES) {
			regex.lastIndex = 0; // 'g' regexes are stateful — reset before reuse
			result = result.replace(regex, (matched) => {
				if (Math.random() < intensity) {
					let chosenWord = options[Math.floor(Math.random() * options.length)];
					
					if (wagon.sanity < 30 && Math.random() < 0.10) {
						chosenWord = applyZalgo(chosenWord);
					}
					
					return chosenWord;
				}
				return matched; 
			});
		}
	}

	let finalText = result;
	if (wagon && wagon.route === "UNO Reverse") {
        finalText = result.split('').reverse().join('');
    }

    speakHint(finalText);
    return finalText;
}

function openCraftingInterface() {
    const content = modalChild;
    const res = wagon.resources;
    
    content.innerHTML = `
        <div class="crafting-container" style="
            background: url('./img/gather/Crafting_Table.png') no-repeat center; 
            background-size: 618px 618px; 
            width: 618px; height: 618px; margin: auto; position: relative;
            font-family: 'Rye'; image-rendering: pixelated;">
            
            <div id="dynamic-grid" style="
                position: absolute; top: 60px; left: 66px; 
                display: grid; grid-template-columns: repeat(3, 72px); 
                grid-template-rows: repeat(3, 72px);
                grid-gap: 12px;">
                ${Array(9).fill().map((_, i) => `<div class="grid-slot" id="slot-${i}" style="width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;"></div>`).join('')}
            </div>

            <div id="result-slot" style="
                position: absolute; top: 92px; right: 64px; 
                width: 172px; height: 172px; 
                display: flex; align-items: center; justify-content: center;
                font-weight: bold; color: #fff; text-shadow: 2px 2px #000;">
                <span id="crafted-item-name" style="text-align: center; font-size: 1.2em;"></span>
            </div>

            <div style="position: absolute; bottom: 135px; width: 100%; text-align: center; color: #e6e6e6; font-size: 1.1em; text-shadow: 1px 1px #000;">
                Wood: ${res["Block of Wood"]} | Meat: ${res["Square Cow"]} | Plants: ${res["Medicinal Plants"]} | Stone: ${res["Glitched Cobblestone"]}
            </div>
			
            <div id="crafting-feedback" style="
                position: absolute; 
                bottom: 100px; 
                width: 100%; 
                text-align: center; 
                color: #00A000; 
                font-size: 1.2em; 
                text-shadow: 1px 1px #000; 
                min-height: 1.2em;
                padding: 0 40px;
				background-color: rgba(0, 0, 0, 0.5); 
                box-sizing: border-box;">
            </div>

            <div class="buttons" style="position: absolute; bottom: 25px; width: 100%; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
                <button onmouseover="showRecipe('Wheel')" onmouseout="clearGrid()" ontouchstart="showRecipe('Wheel')" ${actionAttrs('attemptCraft', ['Wheel'])} class="btn btn-info">Wheel</button>
                <button onmouseover="showRecipe('Axle')" onmouseout="clearGrid()" ontouchstart="showRecipe('Axle')" ${actionAttrs('attemptCraft', ['Axle'])} class="btn btn-info">Axle</button>
                <button onmouseover="showRecipe('Tongue')" onmouseout="clearGrid()" ontouchstart="showRecipe('Tongue')" ${actionAttrs('attemptCraft', ['Tongue'])} class="btn btn-info">Tongue</button>
                <button onmouseover="showRecipe('Medicine')" onmouseout="clearGrid()" ontouchstart="showRecipe('Medicine')" ${actionAttrs('attemptCraft', ['Medicine'])} class="btn btn-info">Meds</button>
                ${wagon.challengeMode !== 'nudist' ? `<button onmouseover="showRecipe('Clothing')" onmouseout="clearGrid()" ontouchstart="showRecipe('Clothing')" ${actionAttrs('attemptCraft', ['Clothing'])} class="btn btn-info">Clothes</button>` : ''}
                <button onmouseover="showRecipe('Rations')" onmouseout="clearGrid()" ontouchstart="showRecipe('Rations')" ${actionAttrs('attemptCraft', ['Rations'])} class="btn btn-info">Food</button>
                <button onmouseover="showRecipe('Firewood')" onmouseout="clearGrid()" ontouchstart="showRecipe('Firewood')" ${actionAttrs('attemptCraft', ['Firewood'])} class="btn btn-info">Firewood</button>
                <button onmouseover="showRecipe('Barrel')" onmouseout="clearGrid()" ontouchstart="showRecipe('Barrel')" ${actionAttrs('attemptCraft', ['Barrel'])} class="btn btn-info">Barrel</button>
                <button onmouseover="showRecipe('Mystery')" onmouseout="clearGrid()" ontouchstart="showRecipe('Mystery')" ${actionAttrs('attemptCraft', ['Mystery'])} class="btn btn-warning">Junk</button>
                <button ${actionAttrs('finalizeCraftingDay')} class="btn btn-danger">Exit</button>
            </div>
        </div>
    `;
}

const CRAFTING_RECIPES = {
    'Wheel':    { slots: [0, 1, 2], icon: 'icon-wood.png' },
    'Axle':     { slots: [3, 4, 5], icon: 'icon-wood.png' },
    'Tongue':   { slots: [6, 7, 8], icon: 'icon-wood.png' },
    'Medicine': { slots: [0, 1], icon: 'icon-plant.png', extraSlots: [3], extraIcon: 'icon-wood.png' },
    'Clothing': { slots: [6, 7, 8], icon: 'icon-plant.png' },
    'Rations':  { slots: [3, 4, 5], icon: 'icon-meat.png'  },
    'Firewood': { slots: [4], icon: 'icon-wood.png' },
    'Barrel':   { slots: [1, 7], icon: 'icon-wood.png' },
    'Mystery':  { slots: [0], icon: 'icon-wood.png', extraSlots: [2, 6, 8], extraIcons: ['icon-meat.png', 'icon-plant.png', 'icon-stone.png'] }
};

function showRecipe(type) {
    const recipes = CRAFTING_RECIPES;

    const r = recipes[type];
    if (r) {
        // Clear old text label
        const resultSlot = document.getElementById('crafted-item-name');
        if (resultSlot) resultSlot.textContent = ""; 

        // Render main icons
        r.slots.forEach(index => {
            const slot = document.getElementById(`slot-${index}`);
            if (slot) slot.innerHTML = `<img src="./img/gather/${r.icon}" style="width: 56px; height: 56px; image-rendering: pixelated; opacity: 0.8;">`;
        });

        // Handle mixed-resource recipes (Medicine/Mystery)
        if (r.extraSlots) {
            r.extraSlots.forEach((index, i) => {
                const icon = r.extraIcons ? r.extraIcons[i] : r.extraIcon;
                const slot = document.getElementById(`slot-${index}`);
                if (slot) slot.innerHTML = `<img src="./img/gather/${icon}" style="width: 56px; height: 56px; image-rendering: pixelated; opacity: 0.8;">`;
            });
        }
    }
}

function clearGrid() {
    document.querySelectorAll('.grid-slot').forEach(slot => slot.innerHTML = '');
}

async function attemptCraft(recipe) {
    const res = wagon.resources;
    const isSurvivalist = hasSkill("Survival");
    const discount = (wagon.professionName === "Gamer") ? 0.5 : 1.0;
    
    // Initial Resource Check
    let canCraft = false;
    let requirements = {};

    if (recipe === 'Wheel') { requirements = { "Block of Wood": Math.max(1, 3 * discount) }; }
    else if (recipe === 'Axle') { requirements = { "Block of Wood": Math.max(1, 2 * discount) }; }
    else if (recipe === 'Tongue') { requirements = { "Block of Wood": Math.max(1, 2 * discount) }; }
    else if (recipe === 'Clothing' && wagon.challengeMode !== 'nudist') { requirements = { "Medicinal Plants": Math.max(1, 3 * discount) }; }
    else if (recipe === 'Clothing') { updateCraftingMessage(translateSanity("Nudist Run: you will not be crafting your way out of this one.")); return; }
    else if (recipe === 'Medicine') { requirements = { "Medicinal Plants": 2, "Block of Wood": 1 }; }
    else if (recipe === 'Rations') { requirements = { "Square Cow": Math.max(1, 3 * discount) }; }
    else if (recipe === 'Firewood') { requirements = { "Block of Wood": 1 }; }
    else if (recipe === 'Barrel') { requirements = { "Block of Wood": 2 }; }
    else if (recipe === 'Mystery') { requirements = { "Block of Wood": 1, "Square Cow": 1, "Medicinal Plants": 1, "Glitched Cobblestone": 1 }; }

    canCraft = Object.keys(requirements).every(k => res[k] >= requirements[k]);

    if (!canCraft) {
        updateCraftingMessage(translateSanity("Not enough pixels. Punch more things."));
        return;
    }

    // Consume Resources
    Object.keys(requirements).forEach(k => res[k] -= requirements[k]);

    // Dramatic Pause
    const resultSlot = document.getElementById('crafted-item-name');
    if (resultSlot) resultSlot.innerHTML = "•";
    
    let dots = "";
    const pauseInterval = setInterval(() => {
        dots += "•";
        if (resultSlot) resultSlot.innerHTML = dots;
    }, 600);

    setTimeout(() => {
        clearInterval(pauseInterval);
        
        const successRoll = Math.random();
        const failThreshold = isSurvivalist ? 0.05 : (0.10 / (wagon.diffMultiplier || 1.0));
    
        if (successRoll < failThreshold) {
            // Update the UI first
            const junkItem = JUNK[Math.floor(Math.random() * JUNK.length)];
            const resultSlot = document.getElementById('result-slot');
            if (resultSlot) {
                resultSlot.innerHTML = `<img src="./img/gather/icon_mystery.png" style="width: 155px; height: 155px; image-rendering: pixelated; filter: grayscale(1);">`;
            }
            updateCraftingMessage(translateSanity(`You spend all day staring at oxen hinds while doing nothing on a boring wagon ride. You are easily distracted these days. CRAFTING FAILED! You made ${junkItem} and tossed it.`), true);
            wagon.sanity = Math.max(0, wagon.sanity - 2);
            
            // DELAY the UI refresh so the user sees the failure icon
            setTimeout(() => { openCraftingInterface(); textUpdateUI(); }, 4000);
        } else {
            finalizeCraftResult(recipe);
            // Delay refresh after success too
            setTimeout(() => { openCraftingInterface(); textUpdateUI(); }, 4000);
        }
    }, 2000);
}

function finalizeCraftResult(recipe) {
    const resultSlot = document.getElementById('crafted-item-name');
    let itemGained = "";
	let msg = translateSanity(`Crafting Successful!`);
    if (!AchievementManager.data.stats.craftedItems.includes(recipe)) {
        AchievementManager.data.stats.craftedItems.push(recipe);
        // "One of every available item" — Nudist Run can never craft Clothing
        // (the button doesn't even show), so that one recipe is excused there.
        const requiredRecipes = Object.keys(CRAFTING_RECIPES).filter(
            r => !(r === 'Clothing' && wagon.challengeMode === 'nudist')
        );
        const hasCraftedEverything = requiredRecipes.every(r => AchievementManager.data.stats.craftedItems.includes(r));
        if (hasCraftedEverything) {
            AchievementManager.unlock('minecrafty', 'Minecrafty');
        }
    }
    AchievementManager.save();

    if (recipe === 'Wheel') {
		wagon.wheels++;
		itemGained = "Wagon Wheel";
		msg = msg + " The step to invent the wheel first truly made sense in this context. ";
	}
    else if (recipe === 'Axle') {
		wagon.axles++;
		itemGained = "Wagon Axle";
	    msg = msg + " Do you axle alotl? ";	
	}
    else if (recipe === 'Tongue') {
		wagon.tongues++;
		itemGained = "Wagon Tongue";
		msg = msg + " In this case, no, cat does not have your tongue. ";	
	}
    else if (recipe === 'Clothing') {
		wagon.clothing++;
		itemGained = "Set of Clothing";
		msg = msg + " Project Runway: 1848, here we come! ";	
	}
    else if (recipe === 'Medicine') {
		wagon.medicine++;
		itemGained = "Bottle of Medicine";
		msg = msg + " What kind of plants are the medicine? Since it is 1848, you are likely making a mix of cocaine and morphine to give your kids. ";	
	}
    else if (recipe === 'Rations') { 
        const gain = 75 + Math.floor(Math.random() * 50);
        wagon.food += gain; 
        itemGained = `${gain} lbs of Salty Beef`;
		msg = msg + " How exactly does this work? ";
        if (wagon.professionName === "Gamer") {
            msg = msg + " You just turned one pixelated cow into a week's worth of steak. This economy is broken. The devs will nerf this. ";
	    } else {
            msg = msg + " How exactly does this work? ";
		}
    }
    else if (recipe === 'Mystery') { 
        const junk = JUNK[Math.floor(Math.random() * JUNK.length)];
        wagon.junk++; 
        itemGained = junk;
		msg = msg + " Do not question it. ";
    }
    else if (recipe === 'Firewood') {
        wagon.firewood += 3;
        itemGained = "3 Firewood Bundles";
        msg = msg + " You split one block of wood into three bundles. Somewhere, an axe is very proud of you. ";
    }
    else if (recipe === 'Barrel') {
        wagon.waterBarrels += 1;
        itemGained = "Empty Water Barrel";
        msg = msg + " One empty barrel, cooper-certified. Fill it with rain, rivers, or tears — whichever comes first out here. ";
    }

    if (resultSlot) {
        // Clear dots and show the large 155x155 icon
        resultSlot.innerHTML = `<img src="./img/gather/icon_${recipe.toLowerCase()}.png" style="width: 155px; height: 155px; image-rendering: pixelated;">`;
    }
	
    const craftToBrokenMap = { 'Wheel': 'wheel', 'Axle': 'axle', 'Tongue': 'tongue' };
    
    if (wagon.isStuck && craftToBrokenMap[recipe] === wagon.brokenPart) {
        wagon.isStuck = false;
        wagon.brokenPart = null;
        updateCraftingMessage(`REPAIR COMPLETE: The new ${recipe} is fitted. You can move again!`);
        if (!AchievementManager.data.stats.partsReplaced.includes(wagon.brokenPart)) {
            AchievementManager.data.stats.partsReplaced.push(wagon.brokenPart);
            if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                AchievementManager.unlock('theseus', 'Ship of Theseus');
            }
        }
        AchievementManager.save();
    }

    msg = msg + `You created: ${itemGained}`;
	updateCraftingMessage(msg);
    textUpdateUI();
	setTimeout(() => { openCraftingInterface(); }, 4000);
}

function finalizeCraftingDay() {
    wagon.turn();
    AudioManager.returnToPreviousBGM();
    toggleModal("#myModal");
    textUpdateUI();
}

function updateCraftingMessage(msg, isError = false) {
    updateActionPrompt(translateSanity(msg));
    const feedback = document.getElementById('crafting-feedback');
    if (feedback) {
        feedback.style.color = isError ? "#d9534f" : "#00A000"; // Red for error, Green for success
        feedback.textContent = msg;
    }
}

function resetStoreInputs() {
    const inputs = document.querySelectorAll("#store input[type='number']");
    inputs.forEach(input => {
        input.value = 0;
        
        input.dispatchEvent(new Event('input'));
    });
}

function hallucinate() {
    const gameScreen = document.getElementById('gameMainScreen');
    const wagonSprite = document.getElementById('wagon-body');
	const oxenSprite = document.getElementById("oxen-sprite");
	const ghostWagon = document.getElementById('ghost-wagon');
    
    if (wagon.sanity < 20 && Math.random() < 0.3) {
        if (wagon.sanity < 15 && Math.random() < 0.99) {
            if (ghostWagon) {
                if (DEBUG) console.log('Ghost Wagon');
				speakHint("Do you see them too, or is it just the prairie madness?");
				ghostWagon.style.display = 'block';
                ghostWagon.style.opacity = (Math.random() * 0.5).toString(); 
                ghostWagon.style.left = `${Math.floor(Math.random() * 60) + 10}%`;
                ghostWagon.style.width = "150px"; 
                ghostWagon.style.top = "40%";
            }
        } else if (ghostWagon) {
            ghostWagon.style.display = 'none';
        }
        const filters = [
            "hue-rotate(90deg) invert(10%)",
            "sepia(1) saturate(5) hue-rotate(-45deg)",
            "contrast(200%) brightness(150%) blur(1px)"
        ];
        gameScreen.style.filter = filters[Math.floor(Math.random() * filters.length)];
        
        if (Math.random() < 0.5) {
            wagonSprite.style.transform = "scaleY(-1)";
            updateActionPrompt(translateSanity("Gravity is just a suggestion."));
        }
    } else {
        // Reset transform to avoid sticking upside down
        gameScreen.style.filter = "none";
		if (ghostWagon) ghostWagon.style.display = 'none';
		if (wagon.route === "UNO Reverse") {
            if (wagonSprite) wagonSprite.style.transform = "scaleY(-1)";
            if (oxenSprite) oxenSprite.style.transform = "scaleY(-1)";
        } else {
            if (wagonSprite) wagonSprite.style.transform = "scaleY(1)";
            if (oxenSprite) oxenSprite.style.transform = "none";
        }
    }
}

const ZONE_PROSPECT_BONUS = {
    1: { bonus: -8, intro: "This plains creek has never seen a nugget in its life, but you dig in anyway." },
    2: { bonus: -8, intro: "Open grazing country, not gold country. Still, the pity meter doesn't know that." },
    3: { bonus: 8,  intro: "The river here runs thick with color. This is the real thing." },
    4: { bonus: 3,  intro: "Not the richest ground, but the Great Basin has given up gold before." },
    5: { bonus: 8,  intro: "Mountain runoff, heavy with sediment — a promising stretch of river." },
};

function startProspecting() {
    const isProspector = hasSkill("Prospecting");
    const isGamer = (wagon.professionName === "Gamer");
	AudioManager.playProspectingBGM();

    let decayRate = 0.86;
    if (isProspector) decayRate = Math.max(decayRate, 0.90);
    if (isGamer) decayRate = Math.max(decayRate, 0.88); // CLICKER_ASSIST.EXE now actually does something

    let hitbox = 7.5; // cqw, up from 6 — was part of the same "too hard to hit" problem
    if (isGamer) hitbox += 1;

    let goldChance = 0.7;
    if (wagon.isSnowing) goldChance = 0.60;
    else if (wagon.hasWater) goldChance = 0.78;

    const zoneProfile = ZONE_PROSPECT_BONUS[wagon.currentZone] || { bonus: 0, intro: "You crouch by the water and get to panning." };

    let startSpeed = isProspector ? 10 : 6;
    startSpeed = startSpeed / difficultyIntensityScale(); // harder settings = faster pixels from the start
    const roundTimer = Math.max(10, Math.round(15 / difficultyIntensityScale()));

    wagon.prospectingState = { 
        pityMeter: isProspector ? 20 : 0, 
        timer: roundTimer, 
        goldClicked: 0,
        currentSpeed: startSpeed,
        decayRate: decayRate,
        speedFloor: 0.8,
        hitbox: hitbox,
        goldChance: goldChance,
        zoneBonus: zoneProfile.bonus,
        lastTop: null, // for spawn collision-avoidance, see spawnGoldPixel
        isProcessing: true 
    };

    updateCraftingMessage(translateSanity(zoneProfile.intro));
    renderProspectingUI();
    startPanningLoop();
}

function startPanningLoop() {
    const s = wagon.prospectingState;
    
    const gameInterval = setInterval(() => {
        if (s.timer > 0) {
            s.timer--;
            const timerEl = document.getElementById('prospecting-timer');
            if (timerEl) timerEl.textContent = `Time: ${s.timer}s`;
            spawnGoldPixel();
        } else {
            clearInterval(gameInterval);
            s.isProcessing = false;
            resolveProspecting(); // Transitions to the Lootbox Reveal
        }
    }, 1000);
}

function renderProspectingUI() {
    const content = modalChild;
    const isProspector = hasSkill("Prospecting");
    const isGamer = (wagon.professionName === "Gamer");

    let skillBadge = "";
    if (isProspector) {
        skillBadge = `<div style="color: #00A000; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;">[SKILL ACTIVE: PROSPECTOR'S EYE]</div>`;
    } else if (isGamer) {
        skillBadge = `<div style="color: #00ffff; font-weight: bold; margin-bottom: 5px; font-size: 0.9em;">[MOD ENABLED: CLICKER_ASSIST.EXE]</div>`;
    }

    content.innerHTML = `
        <div id="prospecting-container" class="mini-game-wrapper" style="background: url('./img/gather/panning_bg.png'); cursor: crosshair; image-rendering: pixelated; border: 5px solid #ffd700;">
            
            <div style="position: absolute; top: 2%; left: 2%; z-index: 20; font-family: 'Courier New'; text-shadow: 2px 2px #000; font-size: 1.8cqw;">
                ${skillBadge}
                <div style="color: gold;">PITY METER: <span id="pity-val">${wagon.prospectingState.pityMeter}</span>%</div>
            </div>
            <div id="prospecting-timer" style="position: absolute; top: 2%; right: 2%; color: white; z-index: 20; font-size: 1.8cqw;">Time: ${wagon.prospectingState.timer}s</div>

            <div id="mini-game-msg-area" style="position: absolute; top: 40%; left: 50%; transform: translateX(-50%); width: 70%; background: rgba(0,0,0,0.8); color: gold; border: 1px solid gold; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 1.4cqw; z-index: 190; pointer-events: none;">
                Pan for gold! Click the pixels.
            </div>
            
            <div id="river-flow" style="width: 100%; height: 100%;"></div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function spawnGoldPixel() {
    const river = document.getElementById('river-flow');
    const s = wagon.prospectingState;

    const pixel = document.createElement('div');
    const isGold = Math.random() < (s.goldChance ?? 0.7);
    const travelTime = s.currentSpeed;
    const hitbox = s.hitbox || 6;

    let top = Math.random() * 80 + 10;
    let attempts = 0;
    while (s.lastTop !== null && Math.abs(top - s.lastTop) < 15 && attempts < 4) {
        top = Math.random() * 80 + 10;
        attempts++;
    }
    s.lastTop = top;

    const goldStyle = `
        background: radial-gradient(circle at 35% 30%, #fff6c8, #ffd700 45%, #b8860b 90%);
        border-radius: 50%;
        border: 0.3cqw solid #5c4408;
        box-shadow: inset 0 0 0 0.35cqw #8b6914, inset 0.3cqw 0.3cqw 0.5cqw rgba(255,255,255,0.6), 0 0 1cqw rgba(255,215,0,0.5);
    `;
    const stoneStyle = `
        background: radial-gradient(circle at 40% 35%, #7a7a72, #565650 60%, #3a3a35 100%);
        border-radius: 42% 58% 55% 45% / 48% 42% 58% 52%;
        border: 0.3cqw solid #222;
        box-shadow: inset -0.3cqw -0.3cqw 0.4cqw rgba(0,0,0,0.5), inset 0.15cqw 0.15cqw 0.3cqw rgba(255,255,255,0.15);
    `;

    pixel.style.cssText = `
        position: absolute;
        width: ${hitbox}cqw; height: ${hitbox}cqw;
        left: -10%; top: ${top}%;
        transition: left ${travelTime}s linear;
        z-index: 10; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        image-rendering: pixelated;
        ${isGold ? goldStyle : stoneStyle}
    `;

    pixel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isGold) {
            s.goldClicked++;
            s.pityMeter = Math.min(100, s.pityMeter + 5);
            s.currentSpeed = Math.max(s.speedFloor || 0.8, s.currentSpeed * (s.decayRate || 0.86));

            const pityVal = document.getElementById('pity-val');
            if (pityVal) pityVal.textContent = s.pityMeter;

            AudioManager.playSound('gold');
            pixel.style.background = 'white';
            pixel.style.boxShadow = 'none';
            pixel.style.fontSize = "1.2cqw";
            pixel.textContent = "FAST!";
        } else {
            AudioManager.playSound('rock');
            shakeElement('prospecting-container');
            pixel.style.fontSize = "1.2cqw";
            pixel.style.color = "#fff";
            pixel.textContent = "DUD";
        }
        setTimeout(() => pixel.remove(), 100);
    });

    river.appendChild(pixel);

    setTimeout(() => { pixel.style.left = '110%'; }, 50);
    setTimeout(() => { if (pixel.parentNode) pixel.remove(); }, (travelTime * 1000) + 50);
}


function resolveProspecting() {
    const content = modalChild;
    const meter = wagon.prospectingState.pityMeter;
    
    AudioManager.playSound('lootbox');

    content.innerHTML = `
        <div style="text-align: center; background: #000; color: gold; padding: 60px; border: 5px solid gold; font-family: 'Courier New';">
            <h2 class="${wagon.sanity < 20 ? 'sanity-glitch' : ''}">PULLING FROM THE RIVER...</h2>
            <div id="gacha-spinner" style="font-size: 3em; margin: 20px 0;">🎰</div>
            <p>Pity Modifier: +${(meter / 2).toFixed(0)}</p>
        </div>
    `;

    setTimeout(() => {
        const baseRoll = Math.random() * 100 + (meter / 2);
        const roll = (baseRoll + (wagon.prospectingState.zoneBonus || 0)) * (wagon.diffMultiplier || 1.0);
        let tier, amount, color, label;

        if (roll > 110) { 
            tier = "LEGENDARY"; amount = 150; color = "gold"; label = "A PHYSICAL BITCOIN"; 
            AchievementManager.unlock('legendary', 'Rare Pull');
			AudioManager.playSound('shiny'); 
        }
        else if (roll > 85) { 
            tier = "EPIC"; amount = 50; color = "purple"; label = "THE MOTHER LODE"; 
            AudioManager.playSound('criticalhit'); 
        }
        else if (roll > 60) { 
            tier = "RARE"; amount = 15; color = "blue"; label = "SHINY PIXEL-DUST"; 
            AudioManager.playSound('meat'); 
        }
        else if (roll > 30) { 
            tier = "UNCOMMON"; amount = 2; color = "green"; label = "FOOL'S GOLD (PYRITE)"; 
        }
        else { 
            tier = "COMMON"; amount = 0; color = "grey"; 
            // Pull a name from your existing JUNK constant
            label = JUNK[Math.floor(Math.random() * JUNK.length)]; 
            AudioManager.playSound('sad'); 
        }

        renderProspectingResult(tier, amount, color, label);
    }, 3000);
}

function renderProspectingResult(tier, amount, color, label) {
    const content = modalChild;
    const isJunk = (amount === 0);

    content.innerHTML = `
        <div style="text-align: center; background: #1a1a1a; color: white; padding: 1cqw; border: 1cqw double ${color};">
            <h2 style="color: ${color}; text-shadow: 0 0 10px ${color}; font-size: 2cqw;">${tier} PULL!</h1>
            <img src="./img/gather/lootbox.png" style="width: 80%; filter: drop-shadow(0 0 15px ${color}) ${isJunk ? 'grayscale(1)' : ''};">
            <h3 style="text-transform: uppercase; font-size: 1.5cqw;">${label}</h2>
            <p style="font-size: 0.9cqw;">${isJunk ? "Value: Absolute Zero" : `Value: $${amount.toFixed(2)}`}</p>
            <button ${actionAttrs('finalizeProspecting', [amount, label])} class="btn btn-success" style="font-size: 0.8cqw; padding: 1cqw 2cqw;">
                ${isJunk ? "Add to Junk Pile" : "Collect Loot"}
            </button>
        </div>
    `;

    if (isJunk) {
        wagon.junk++;
        wagon.sanity = Math.max(0, wagon.sanity - 1); // Disappointment
    }
}

function finalizeProspecting(amount, label) {
    wagon.money += amount;
    updateActionPrompt(translateSanity(`You cashed in your ${label} for $${amount}. The grind never stops.`));
	eventLog.insertAdjacentHTML('afterbegin', `You cashed in your ${label} for $${amount}. The grind never stops.<br>`);
    textUpdateUI();
	wagon.turn();
    toggleModal("#myModal");
	AudioManager.returnToPreviousBGM();
}

const TRADE_BASE_VALUES = {
    "oxen": 20, "clothing": 10, "bullets": 0.5, "wheels": 10,
    "axles": 10, "tongues": 10, "medicine": 5, "food": 0.2, "books": 2,
    "junk": 2.5, "firewood": 1, "waterBarrels": 4
};

const TRADE_ZONE_WEIGHTS = {
    1: { food: 2.0, oxen: 1.5 },                                              // Great Plains East — well-worn, food-focused corridor
    2: { food: 2.0, oxen: 1.5 },                                              // Great Plains West — same
    3: { wheels: 2.0, axles: 2.0, tongues: 2.0, medicine: 1.5, firewood: 1.5 }, // Rocky Mountains — rough roads, cold nights
    4: { waterBarrels: 2.5, medicine: 1.5 },                                  // Great Basin — scarcity country
    5: { wheels: 1.5, axles: 1.5, tongues: 1.5, firewood: 2.0 },              // Blue Mountains — rough roads, forested
};

function pickWeightedTradeItem(pool, zone) {
    const weights = TRADE_ZONE_WEIGHTS[zone] || {};
    const weighted = pool.map(item => ({ item, weight: weights[item] || 1.0 }));
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * total;
    for (const w of weighted) {
        roll -= w.weight;
        if (roll <= 0) return w.item;
    }
    return weighted[weighted.length - 1].item;
}

const TRADE_TEMPERAMENTS = {
    "Stubborn":  { askMult: 1.15, clue: "They don't look like the type to budge on price." },
    "Desperate": { askMult: 0.85, clue: "They seem awful eager to make a deal, any deal." },
    "Fair":      { askMult: 1.00, clue: "They seem like a reasonable sort, willing to hear you out." },
};

function calculateTradeConfidence() {
    const s = wagon.tradeState;

    let totalOfferValue = s.playerCashOffer;
    s.playerBasket.forEach(entry => {
        let val = (TRADE_BASE_VALUES[entry.item] || 0) * entry.qty;
        if (s.desireItem === entry.item) val *= 3.0;
        totalOfferValue += val;
    });
    if (hasSkill("Trade")) totalOfferValue *= 1.2; // Merchant Bonus

    let npcAsk = (TRADE_BASE_VALUES[s.npcOffer.item] || 0) * s.npcOffer.qty;
    npcAsk *= (s.temperamentAskMult || 1.0);
    npcAsk *= (s.weatherAskMult || 1.0);

    let confidence = npcAsk > 0 ? (totalOfferValue / npcAsk) * 100 : 0;

    if (s.hasClue && !s.clueBonusUsed) confidence += 12;

    confidence = confidence / difficultyIntensityScale();

    return confidence;
}

function startTrade() {
    const items = (wagon.challengeMode === 'nudist')
        ? ["oxen", "bullets", "wheels", "axles", "tongues", "medicine", "food", "books", "junk", "firewood", "waterBarrels"]
        : ["oxen", "clothing", "bullets", "wheels", "axles", "tongues", "medicine", "food", "books", "junk", "firewood", "waterBarrels"];
    const isGamer = (wagon.professionName === "Gamer");
	AudioManager.playTradingBGM();
    
    AudioManager.playSound('trade');

    let gamerLine = "";
    if (isGamer) {
        const lines = [
            "System: Local economy detected. Initiating 'Buy Low, Sell High' protocol.",
            "Gamer.exe: This NPC's AI is primitive. Time for some aggressive arbitrage.",
            "4th Wall: I hope this trader has a better drop table than the last river-crossing.",
            "Console: Trade.dll loaded. Remember, everything is a fetch-quest if you try hard enough."
        ];
        gamerLine = lines[Math.floor(Math.random() * lines.length)];
    }

    const zone = wagon.currentZone;

    let maxOffers = hasSkill("Trade") ? 5 : 3;
    let weatherAskMult = 1.0;
    if (wagon.isSnowing || wagon.hasWater) {
        maxOffers = Math.max(2, maxOffers - 1);
        weatherAskMult = 0.90;
    }

    const temperamentNames = Object.keys(TRADE_TEMPERAMENTS);
    const temperament = temperamentNames[Math.floor(Math.random() * temperamentNames.length)];

    wagon.tradeState = {
        npcName: NPC_names[Math.floor(Math.random() * NPC_names.length)],
        desireItem: pickWeightedTradeItem(items, zone),
        gamerDialogue: gamerLine, //
        hasClue: false,
        clueBonusUsed: false,
        temperament: temperament,
        temperamentRevealed: false,
        temperamentAskMult: TRADE_TEMPERAMENTS[temperament].askMult,
        weatherAskMult: weatherAskMult,
        engaged: false, // set true by Small Talk, an offer, or the joke option — see cancelTrade
        offersMade: 0,
        maxOffers: maxOffers,
        npcOffer: { item: pickWeightedTradeItem(items, zone), qty: 1 },
        playerBasket: [],
        playerCashOffer: 0
    };

    renderTradeUI();
    
    const modal = document.querySelector("#myModal");
    if (modal && !modal.classList.contains('active')) {
        toggleModal("#myModal");
    }
}

function renderTradeUI() {
    const content = modalChild;
    const s = wagon.tradeState;
    const isMerchant = hasSkill("Trade");

    content.innerHTML = `
        <div id="trade-container" class="mini-game-wrapper" style="background: url('./img/gather/trade_bg.png'); font-family: 'Rye'; image-rendering: pixelated; border: 4px solid #ffd700;">
		    <div style="position: absolute; top: 10px; right: 20px; color: #ffd700; font-size: 1.5em; transform: rotate(5deg); border: 1px solid #ffd700; padding: 2px 5px; background: rgba(0,0,0,0.7);">
                OXEN TYCOON: AdVenture Capitalist - 1848 Edition ${wagon.professionName === 'Gamer' ? ' <span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''} ${isMerchant === true ? '<br><span style="color: cyan; font-size: 1.2cqw;">TRADE SKILL BOOST ACTIVE!</span>' : ''}
            </div>

            <div id="trade-dialogue" style="position: absolute; top: 60px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #00A000; padding: 12px; width: 88%; min-height: 100px; border: 2px solid #555; text-align: center; z-index: 20;">
                <div style="color: #fff; font-size: 1.1em; border-bottom: 1px solid #333; margin-bottom: 5px; padding-bottom: 3px;">
                    TRADING WITH ${s.npcName.toUpperCase()}
                </div>
                ${s.gamerDialogue ? `<div style="color: #00ffff; font-size: 0.75em; margin-bottom: 5px; font-style: italic;">${s.gamerDialogue}</div>` : ''}
                ${isMerchant ? '<div style="color: #ffff00; font-size: 0.8em; margin-bottom: 5px;">[INSIDER TRADING ACTIVE]</div>' : ''}
                
                <div id="confidence-meter-container" style="width: 100%; background: #222; height: 8px; margin-bottom: 8px; border: 1px solid #444; display: none;">
                    <div id="confidence-bar" style="width: 0%; height: 100%; background: #00A000; transition: width 0.4s;"></div>
                </div>

                <span id="npc-speech" style="font-size: 0.9em;">"Howdy traveler. Care to swap some pixels?"</span>
            </div>
			
			<div id="mini-game-msg-area" style="position: absolute; top: 45%; left: 50%; transform: translateX(-50%); width: 80%; background: rgba(0,255,255,0.1); color: #00ffff; border: 1px solid #00ffff; padding: 3px; text-align: center; font-family: 'Courier New'; font-size: 1.2cqw; z-index: 100; pointer-events: none;">
                Analyzing market conditions...
            </div>

            <div id="trade-action-area" class="buttons" style="position: absolute; bottom: 85px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <div style="display: flex; gap: 8px;">
                    <button ${actionAttrs('tradeTalk')} class="btn btn-info">Make Small Talk</button>
                    <button ${actionAttrs('openOfferMenu')} class="btn btn-success">Make an Offer</button>
                    <button ${actionAttrs('jokeTrade')} class="btn btn-warning">Offer Spouse</button>
                </div>
                <button ${actionAttrs('cancelTrade')} class="btn btn-danger">Leave Trade</button>
            </div>
        </div>
    `;
}

function cancelTrade() {
    AudioManager.returnToPreviousBGM();
    if (wagon.tradeState && wagon.tradeState.engaged) {
        wagon.turn();
        textUpdateUI();
    }
    toggleModal("#myModal");
}

function tradeTalk() {
    const s = wagon.tradeState;
    s.engaged = true;
    const successChance = hasSkill("Trade") ? 0.8 : 0.4;
    const speech = document.getElementById('npc-speech'); //

    if (Math.random() < successChance) {
        const clueList = TradeClues[s.desireItem];
        const clue = clueList[Math.floor(Math.random() * clueList.length)];
        let temperamentLine = "";
        if (!s.temperamentRevealed) {
            s.temperamentRevealed = true;
            temperamentLine = ` ${TRADE_TEMPERAMENTS[s.temperament].clue}`;
        }
        speech.textContent = `"${clue}"${temperamentLine}`; //
        s.hasClue = true;
        updateActionPrompt(translateSanity(`You picked up on ${s.npcName}'s hint. They really need ${s.desireItem}.`));
    } else {
        speech.textContent = `"I don't have time for small talk, friend. What've you got?"`; //
    }
}

function jokeTrade() {
    const s = wagon.tradeState;
    s.engaged = true;
    const speech = document.getElementById('npc-speech'); //
    speech.innerHTML = `<span style="color: #ff00ff;">"They have no interest in a wife-swap, but now your wife may want to replace you."</span>`;
    wagon.sanity = Math.max(0, wagon.sanity - 5);
    textUpdateUI();
}

function openOfferMenu() {
    const actionArea = document.getElementById('trade-action-area');
    const s = wagon.tradeState;
    const items = ["clothing", "bullets", "wheels", "axles", "tongues", "medicine", "food", "books", "junk", "firewood", "waterBarrels"];
    
    // Calculate current basket value for the UI
    let currentBasketText = s.playerBasket.map(i => `${i.qty} ${i.item}`).join(", ") || "Empty";

    const estConfidence = calculateTradeConfidence();
    const confColor = estConfidence >= 100 ? '#00ff00' : (estConfidence >= 75 ? '#ff8800' : '#ff4444');

    actionArea.innerHTML = `
        <div style="background: rgba(0,0,0,0.9); padding: 10px; border: 2px solid #ffd700; width: 95%; color: white;">
            <p>Trading for: <strong>${s.npcOffer.qty} ${s.npcOffer.item}</strong></p>
            <div style="font-size: 0.8em; margin-bottom: 5px; color: #aaa;">Basket: ${currentBasketText} | Cash: $${s.playerCashOffer}</div>
            <div style="font-size: 0.85em; margin-bottom: 5px; color: ${confColor};">Estimated Confidence: ${estConfidence.toFixed(0)}%</div>
            
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-height: 100px; overflow-y: auto;">
                ${items.map(item => {
                    const count = Math.floor(wagon[item]);
                    return count > 0 ? `<button ${actionAttrs('addToBasket', [item])} class="btn btn-dark" style="font-size: 0.7em;">+1 ${item}</button>` : "";
                }).join("")}
            </div>

            <div style="margin-top: 8px;">
                <input type="number" inputmode="decimal" pattern="[0-10]*" id="trade-cash-input" placeholder="Add Cash $" style="width: 80px; background: #222; color: gold; border: 1px solid gold;">
                <button ${actionAttrs('addCashToTrade')} class="btn btn-warning" style="padding: 2px 10px;">Add $</button>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: center;">
                <button ${actionAttrs('setTradeOffer')} class="btn btn-success">Submit Proposal</button>
                <button ${actionAttrs('clearBasket')} class="btn btn-secondary">Clear</button>
                <button ${actionAttrs('renderTradeUI')} class="btn btn-danger">Back</button>
            </div>
        </div>
    `;
}

function addToBasket(item) {
    const s = wagon.tradeState;
    const existing = s.playerBasket.find(i => i.item === item);
    // Logic: Don't offer more than you have
    const currentInBasket = existing ? existing.qty : 0;
    
    if (wagon[item] > currentInBasket) {
        if (existing) existing.qty++;
        else s.playerBasket.push({ item: item, qty: 1 });
        AudioManager.playSound('trade'); //
    }
    openOfferMenu();
}

function clearBasket() {
    const s = wagon.tradeState;
    s.playerBasket = [];
    s.playerCashOffer = 0;
    openOfferMenu();
}

function getBasketQty(itemName) {
    const item = wagon.tradeState.playerBasket.find(i => i.item === itemName);
    return item ? item.qty : 0;
}

function addCashToTrade() {
    const amt = parseFloat(document.getElementById('trade-cash-input').value) || 0;
    if (amt <= wagon.money) {
        wagon.tradeState.playerCashOffer = amt;
        openOfferMenu();
    }
}

function setTradeOffer() {
    const s = wagon.tradeState;
    s.engaged = true;

    const confidence = calculateTradeConfidence();
    if (s.hasClue && !s.clueBonusUsed) s.clueBonusUsed = true;

    processHaggle(confidence);
}

function processHaggle(confidence) {
    const s = wagon.tradeState;
    const speech = document.getElementById('npc-speech');
    const bar = document.getElementById('confidence-bar');
    const meterCont = document.getElementById('confidence-meter-container');
    
    meterCont.style.display = "block";
    bar.style.width = `${Math.min(100, confidence)}%`;
    s.offersMade++;

    if (confidence >= 100) {
        finalizeTrade(true);
    } 
    else if (confidence >= 75 && s.offersMade < s.maxOffers) {
        const extraCash = Math.ceil((1 - (confidence/100)) * 20); // Small cash demand
        speech.innerHTML = `<span style="color: #ff8800;">"You're almost there, friend. Throw in another $${extraCash} and we have a deal."</span>`;
        
        // Update the UI to show the "Accept Counter" button
        const actionArea = document.getElementById('trade-action-area');
        actionArea.innerHTML = `
            <div style="background: rgba(255,204,0,0.2); padding: 10px; border: 1px solid #ff8800; width: 90%; color: white;">
                <button ${actionAttrs('acceptCounter', [extraCash])} class="btn btn-warning" ${wagon.money < extraCash ? 'disabled' : ''}>Accept Counter (Pay $${extraCash})</button>
                <button ${actionAttrs('openOfferMenu')} class="btn btn-info">Revise My Offer</button>
            </div>
        `;
        AudioManager.playSound('trade');
    } 
    else if (s.offersMade >= s.maxOffers) {
        speech.textContent = `"I'm done talkin'. My wheels are turnin' even if yours ain't."`;
        setTimeout(() => { toggleModal("#myModal"); wagon.turn(); }, 2000);
    } 
    else {
        const rejectionMsgs = ["Not even close.", "Do I look like a charity?", "My ox could make a better offer."];
        speech.textContent = `"${rejectionMsgs[Math.floor(Math.random() * rejectionMsgs.length)]}"`;
    }
}

function acceptCounter(extra) {
    wagon.tradeState.playerCashOffer += extra;
    finalizeTrade(true);
}

function finalizeTrade(success) {
    if (!success) return;
    
    const s = wagon.tradeState;
    
    // Play the 'Victory' sound for a successful negotiation
    AudioManager.playSound('takethetrade');

    s.playerBasket.forEach(entry => {
        wagon[entry.item] -= entry.qty;
        if (entry.item === "waterBarrels") {
            wagon.water = Math.max(0, wagon.water - entry.qty * WATER_PER_BARREL);
        }
    });
    wagon.money -= s.playerCashOffer;

    // Receive goods
    const receiveItem = s.npcOffer.item;
    const receiveQty = s.npcOffer.qty;
    if (receiveItem === "food") wagon.food += receiveQty;
    else if (receiveItem === "bullets") wagon.bullets += receiveQty;
    else if (receiveItem === "waterBarrels") {
        // Same "barrels arrive full" rule the store uses at checkout.
        wagon.waterBarrels += receiveQty;
        wagon.water += receiveQty * WATER_PER_BARREL;
    }
    else wagon[receiveItem] += receiveQty;

    // REWARD: Successful social interaction restores sanity
    wagon.sanity = Math.min(100, wagon.sanity + 5);
	AudioManager.returnToPreviousBGM();

    const displayNames = { waterBarrels: "water barrel" };
    const receiveLabel = displayNames[receiveItem] || receiveItem;

    const content = modalChild;
    content.innerHTML = `
        <div style="text-align: center; background: #1a1a1a; color: white; padding: 40px; border: 5px solid #ffd700; font-family: 'Rye';">
            <h1 style="color: gold;">TRADE SUCCESSFUL!</h1>
            <p>You received ${receiveQty} ${receiveLabel}${receiveQty === 1 ? '' : 's'}.</p>
            <p style="color: #00A000; font-size: 0.9em;">+5 Sanity (The deal made you feel competent!)</p>
            <button ${actionAttrs('completeTradeSession')} class="btn btn-success">Continue Journey</button>
        </div>
    `;   
    const tradeToBrokenMap = { "wheels": "wheel", "axles": "axle", "tongues": "tongue" };
    
    if (wagon.isStuck && tradeToBrokenMap[receiveItem] === wagon.brokenPart) {
        if (!AchievementManager.data.stats.partsReplaced.includes(wagon.brokenPart)) {
            AchievementManager.data.stats.partsReplaced.push(wagon.brokenPart);
            if (AchievementManager.data.stats.partsReplaced.length >= 3) {
                AchievementManager.unlock('theseus', 'Ship of Theseus');
            }
        }
        AchievementManager.save();
        wagon.isStuck = false;
        wagon.brokenPart = null;
    }
}

function completeTradeSession() {
    wagon.turn();
    textUpdateUI();
    toggleModal("#myModal");
}

function startRiverRafting() {
    AudioManager.playRaftingBGM();
    
    const hasRepair = hasSkill("Repair");
    const hasSurvival = hasSkill("Survival");
    const isGamer = (wagon.professionName === "Gamer");
	const isReverse = (wagon.route === "UNO Reverse");

    const isStormy = !!(wagon.isSnowing || wagon.hasWater);
    const weatherSpeedMult = isStormy ? 1.12 : 1.0;

    wagon.raftState = {
        distance: 0,
        target: 7200,
        health: hasRepair ? 7 : 5, // Repair Buff
        maxHealth: hasRepair ? 7 : 5, // for the Dry Run achievement check at the end
        tookDamage: false,
        isProcessing: true,
        obstacles: [],
        // Survival Buff: Start slower (4 instead of 5)
        speed: hasSurvival ? 1 : 2, 
        maxSpeed: hasSurvival ? 8 : 9,
        lastSpawn: 0,
        spawnRate: hasSurvival ? 1800 : 1500,
        isGamer: isGamer,
        isStormy: isStormy,
        spawnedFinish: false,
		isReverseRoute: isReverse,
        baseControlsInverted: isReverse, // Base state is inverted if reverse route
        controlsInverted: false,         // Temporary state tracking from vortexes
        vortexTimeoutId: null            // guards against a second vortex hit cutting the first one's timer short
    };
	wagon.raftState.speed *= difficultyIntensityScale() * weatherSpeedMult;
    wagon.raftState.maxSpeed *= difficultyIntensityScale() * weatherSpeedMult;
    renderRaftUI();
    raftLoop();
}

function takeTollRoad() {
    if (wagon.money < 50) {
        updateActionPrompt(translateSanity("The toll-keeper laughs. 'No gold, no road. Try the river, pauper.'"));
		eventLog.insertAdjacentHTML('afterbegin', `The toll-keeper laughs. 'No gold, no road. Try the river, pauper.'<br>`);
        return;
    }
    wagon.money -= 50;
    wagon.days += 7; // The road is safe but slow
	wagon.currentLandmark = "Willamette Valley";
    finalizeJourney(true); 
}

function renderRaftUI() {
    const content = modalChild;
    const hasRepair = hasSkill("Repair");
    const hasSurvival = hasSkill("Survival");
    const s = wagon.raftState;
    
    const containerStyle = s.isReverseRoute 
        ? "background: url('./img/raft/river_bg.png'); border: 5px solid #ff0000; filter: invert(100%) hue-rotate(180deg);" 
        : "background: url('./img/raft/river_bg.png'); border: 5px solid #0000ff;";

    const playerStyle = s.isReverseRoute
        ? "position: absolute; left: 8%; top: 60%; width: 16.1cqw; z-index: 50; image-rendering: pixelated; transform: scaleY(-1);"
        : "position: absolute; left: 8%; top: 60%; width: 16.1cqw; z-index: 50; image-rendering: pixelated;";

    const messageText = s.isReverseRoute
        ? "¡sʎǝʞ ʍoɹɹ∀ ǝs∩ ˙spıdɐɹ pǝʇɹǝʌuı ǝɥʇ ǝʇɐbıʌɐN"
        : 'Navigate the rapids! Arrow Keys, WASD<span class="dpad-hint">, or the controls below</span>.';

    // Purely cosmetic — the weather effect that actually matters (speed) is already baked into wagon.raftState.speed/maxSpeed by this point.
    const stormOverlay = s.isStormy
        ? `<div style="position:absolute; inset:0; z-index:80; pointer-events:none; background:repeating-linear-gradient(115deg, rgba(200,220,255,0.12) 0px, rgba(200,220,255,0.12) 2px, transparent 2px, transparent 14px); opacity:0.8;"></div>`
        : '';

    content.innerHTML = `
        <div id="raft-game-container" class="mini-game-wrapper" style="${containerStyle}">
            <img src="./img/raft/raft_side.png" id="raft-player" style="${playerStyle}">
            ${stormOverlay}
            
            <div id="raft-hud" style="position: absolute; top: 2%; left: 2%; color: white; text-shadow: 2px 2px #000; font-family: 'Courier New'; z-index: 100; font-size: 2cqw;">
                PROGRESS: <span id="raft-dist">0</span>m | LIVES: <span id="raft-lives">3</span>
                ${wagon.professionName === 'Gamer' ? '<br><span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''} 
                ${hasSurvival ? '<br><span style="color: cyan; font-size: 1.2cqw;">SURVIVAL SKILL BOOST ACTIVE!</span>' : ''} 
                ${hasRepair ? '<br><span style="color: cyan; font-size: 1.2cqw;">REPAIR SKILL BOOST ACTIVE!</span>' : ''}
                ${s.isStormy ? '<br><span style="color: #a0c8ff; font-size: 1.2cqw;">STORM: rougher, faster water</span>' : ''}
            </div>

            <div id="mini-game-msg-area" style="position: absolute; top: 35%; left: 50%; transform: translateX(-50%); width: 80%; background: rgba(0,0,0,0.7); color: #00ffff; border: 1px solid #0000ff; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 1.4cqw; z-index: 190; pointer-events: none;">
                ${messageText}
            </div>

            <div id="raft-dpad" class="dpad-touch-controls dpad-grid" style="position:absolute; bottom:3%; right:3%; z-index:150; grid-template-columns:repeat(3, 9cqw); grid-template-rows:repeat(2, 9cqw); gap:1cqw; user-select:none;">
                <button id="raft-dpad-up" style="grid-column:2; grid-row:1; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #fff; border-radius:8px; touch-action:none;">&#9650;</button>
                <button id="raft-dpad-left" style="grid-column:1; grid-row:2; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #fff; border-radius:8px; touch-action:none;">&#9664;</button>
                <button id="raft-dpad-down" style="grid-column:2; grid-row:2; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #fff; border-radius:8px; touch-action:none;">&#9660;</button>
                <button id="raft-dpad-right" style="grid-column:3; grid-row:2; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #fff; border-radius:8px; touch-action:none;">&#9654;</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    bindRaftDpad();
}

function bindRaftDpad() {
    const bind = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (e) => { e.preventDefault(); keys[keyName] = true; };
        const release = (e) => { e.preventDefault(); keys[keyName] = false; };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release);
        btn.addEventListener('touchcancel', release);
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };
    bind('raft-dpad-up', 'ArrowUp');
    bind('raft-dpad-down', 'ArrowDown');
    bind('raft-dpad-left', 'ArrowLeft');
    bind('raft-dpad-right', 'ArrowRight');
}

// Logic to scroll the river background
let raftScroll = 0;
function scrollRiver() {
    const container = document.getElementById('raft-game-container');
    if (container) {
        raftScroll += 10; // Speed of the river
        container.style.backgroundPositionX = `${raftScroll}px`;
    }
}

function raftLoop() {
    if (!wagon || !wagon.raftState || !wagon.raftState.isProcessing) return;

    const s = wagon.raftState;
    handleRaftMovement();
    
    if (s.distance > 0 && s.distance % 100 === 0 && s.speed < s.maxSpeed) {
        s.speed += 0.2;
        const spawnFloor = Math.max(250, Math.round(400 / difficultyIntensityScale()));
        s.spawnRate = Math.max(spawnFloor, s.spawnRate - 50); 
    }

    s.distance += 2; 
    
    const distText = document.getElementById('raft-dist');
    if (distText) distText.textContent = Math.floor(s.distance / 10);
    const livesText = document.getElementById('raft-lives');
    if (livesText) livesText.textContent = Math.ceil(s.health);

    const container = document.getElementById('raft-game-container');
    if (container) {
        container.style.backgroundPositionX = `${+(s.distance * 0.1)}%`;
    }

    if (Date.now() - s.lastSpawn > s.spawnRate) {
        spawnRaftObstacle();
        s.lastSpawn = Date.now();
    }

    const raft = document.getElementById('raft-player');
    if (!raft) return;
    const raftRect = raft.getBoundingClientRect();

    for (let index = s.obstacles.length - 1; index >= 0; index--) {
        const obj = s.obstacles[index];
        let currentLeft = parseFloat(obj.el.style.left) || 110;
    
        currentLeft -= (s.speed * 0.1);
        obj.el.style.left = `${currentLeft}%`;
    
        const objRect = obj.el.getBoundingClientRect();
        const collisionOccurred = (
            raftRect.left < objRect.right &&
            raftRect.right > objRect.left &&
            raftRect.top < objRect.bottom &&
            raftRect.bottom > objRect.top
        );
    
        if (collisionOccurred) {
            if (obj.isFinish) {
                s.isProcessing = false;
                if (!s.tookDamage) AchievementManager.unlock('dry_run', 'Dry Run');
                updateActionPrompt(translateSanity("A winner is you!"));
                eventLog.insertAdjacentHTML('afterbegin', `A winner is you!<br>`);
                
                wagon.currentLandmark = s.isReverseRoute ? "Independence" : "Willamette Valley";
                finalizeJourney(true);
                return; 
            } else if (obj.el.dataset.type === "vortex") {
                if (s.vortexTimeoutId) clearTimeout(s.vortexTimeoutId);
                s.controlsInverted = true;
                s.vortexTimeoutId = setTimeout(() => { s.controlsInverted = false; s.vortexTimeoutId = null; }, 3000);
    
                raft.style.transition = "transform 1s";
                // Keep inverted rotation looking correct depending on active state
                raft.style.transform = s.isReverseRoute ? "scaleY(-1) rotate(-360deg)" : "rotate(360deg)";
    
                s.distance = Math.max(0, s.distance - 400);
                AudioManager.playSound('river');
                updateActionPrompt(translateSanity("SWIRLED! The vortex dragged you back downstream!"));
                
                setTimeout(() => {
                    raft.style.transition = "none";
                    raft.style.transform = s.isReverseRoute ? "scaleY(-1)" : "none";
                }, 1000);
    
                obj.el.remove();
                s.obstacles.splice(index, 1);
            } else if (obj.el.dataset.type === "wave") {
                const foodLost = Math.min(wagon.food, 15 + Math.floor(Math.random() * 16));
                wagon.food = Math.max(0, wagon.food - foodLost);
                AudioManager.playSound('river');
                updateActionPrompt(translateSanity(`A rogue wave crashes over the bow — ${foodLost} lbs of food washes overboard!`));
                obj.el.remove();
                s.obstacles.splice(index, 1);
            } else {
                triggerRaftCollision(index);
                updateActionPrompt(translateSanity("Are you trying to drown your family? Avoid the rocks!"));
            }
        }
    
        if (currentLeft < -20) {
            obj.el.remove();
            s.obstacles.splice(index, 1);
        }
    }

    if (s.distance >= s.target && s.isProcessing) {
        s.isProcessing = false;
        if (!s.tookDamage) AchievementManager.unlock('dry_run', 'Dry Run');
        // FIX: Route target validation on fallback out-of-bounds safety thresholds
        wagon.currentLandmark = s.isReverseRoute ? "Independence" : "Willamette Valley";
        finalizeJourney(true);
    } else if (s.health > 0) {
        requestAnimationFrame(raftLoop);
    }
}

function handleRaftMovement() {
    const raft = document.getElementById('raft-player');
    if (!raft) return;

    let top = parseFloat(raft.style.top) || 60;
    let left = parseFloat(raft.style.left) || 8;
    
    const s = wagon.raftState;
    const moveSpeed = 0.8; 

    let rawUp    = keys["ArrowUp"]    || keys["w"] || keys["W"] || gamepadState.up;
    let rawDown  = keys["ArrowDown"]  || keys["s"] || keys["S"] || gamepadState.down;
    let rawLeft  = keys["ArrowLeft"]  || keys["a"] || keys["A"] || gamepadState.left;
    let rawRight = keys["ArrowRight"] || keys["d"] || keys["D"] || gamepadState.right;

    let dynamicInvert = s.baseControlsInverted ? !s.controlsInverted : s.controlsInverted;

    let upPressed    = dynamicInvert ? rawDown  : rawUp;
    let downPressed  = dynamicInvert ? rawUp    : rawDown;
    let leftPressed  = dynamicInvert ? rawRight : rawLeft;
    let rightPressed = dynamicInvert ? rawLeft  : rawRight;

    if (upPressed)    top  = Math.max(40, top - moveSpeed);
    if (downPressed)  top  = Math.min(89, top + moveSpeed);
    if (leftPressed)  left = Math.max(2,  left - moveSpeed);
    if (rightPressed) left = Math.min(75, left + moveSpeed);

    raft.style.top  = `${top}%`;
    raft.style.left = `${left}%`;
}


function triggerRaftCollision(index) {
    const s = wagon.raftState;
    
    // Gamer Passive: Half damage
    const damage = s.isGamer ? 0.5 : 1; 
	s.health = Math.max(0, s.health - damage);
    s.tookDamage = true; // Dry Run achievement requires this to stay false
    
    document.getElementById('raft-lives').textContent = Math.ceil(s.health);
    
    s.obstacles[index].el.remove();
    s.obstacles.splice(index, 1);

    const raft = document.getElementById('raft-player');
    s.isProcessing = false;
    AudioManager.playSound('miss');
    shakeElement('raft-game-container');

    if (s.health <= 0) {
        raft.classList.add('raft-sinking');
        setTimeout(() => { finalizeJourney(false); }, 2000);
    } else {
        const buffer = document.createElement('div');
        buffer.id = "buffer-overlay";
        // Gamer Penalty: Extra text in the buffer
        const bufferText = s.isGamer ? "HIGH_LATENCY_DETECTION... PACKET_LOSS_X2" : "BUFFERING... FRAME_DROP_ERROR";
        buffer.innerHTML = `<img src="./img/raft/hourglass_sprite.png" class="spinning" style="width: 12.9cqw;">
                        <p style="color:white; font-family: 'Courier New'; font-size: 2cqw;">${bufferText}</p>`;
        buffer.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:200;";
        document.getElementById('raft-game-container').appendChild(buffer);

        // Gamer Penalty: 3 seconds of lag instead of 1.5
        const lagDuration = s.isGamer ? 3000 : 1500; 
        
        setTimeout(() => {
            buffer.remove();
            s.isProcessing = true;
            raftLoop();
        }, lagDuration);
    }
}

function spawnRaftObstacle() {
    const container = document.getElementById('raft-game-container');
    const s = wagon.raftState;
    const obstacleCap = (s.distance >= s.target / 2) ? 4 : 3;
    if (s.obstacles.length >= obstacleCap) return; 

    let el;
    
    if (s.distance >= s.target - 200 && !s.spawnedFinish) {
        el = document.createElement('img');
        el.src = "./img/raft/finish_line.png";
        // Finish line uses 16.1cqw width
        el.style.cssText = `position:absolute; left:110%; top:50%; width:16.1cqw; height:40%; z-index:100; image-rendering: pixelated;`;
        s.spawnedFinish = true;
        s.isVictorySpawn = true;
    } else {
        const roll = Math.random();
        // rock 55% / vortex 20% / wave 25% — rock stays the primary threat,
        // wave is the new "costs supplies, not blood" mercy obstacle (see
        // its handling in raftLoop).
        const obstacleType = roll < 0.20 ? "vortex" : (roll < 0.45 ? "wave" : "rock");

        const lastObj = s.obstacles[s.obstacles.length - 1];
        let newTop = Math.random() * 35 + 50; // Spawning in the river lane (40% - 75% height)
        
        if (lastObj) {
            const lastTop = parseFloat(lastObj.el.style.top);
            if (Math.abs(newTop - lastTop) < 12) newTop = (newTop + 20) % 35 + 40;
        }

        if (obstacleType === "wave") {
            el = document.createElement('div');
            el.textContent = "\u{1F30A}"; // 🌊
            el.style.cssText = `position:absolute; left:110%; top:${newTop}%; width:9.7cqw; height:9.7cqw; font-size:7cqw; line-height:9.7cqw; text-align:center; z-index:60; filter: drop-shadow(0 0 0.3cqw #0af);`;
        } else {
            el = document.createElement('img');
            el.src = obstacleType === "vortex" ? "./img/raft/vortex.png" : "./img/raft/rock_pixel.png";
            // Obstacles use 9.7cqw width
            el.style.cssText = `position:absolute; left:110%; top:${newTop}%; width:9.7cqw; z-index:60; image-rendering: pixelated;`;
        }
        el.dataset.type = obstacleType;
    }
    
    container.appendChild(el);
    s.obstacles.push({ el: el, isFinish: s.isVictorySpawn });
    s.isVictorySpawn = false;
}

function finalizeJourney(reachedDestination) {
    if (wagon.raftState) wagon.raftState.isProcessing = false;
    if (wagon.finaleState) wagon.finaleState.isProcessing = false;
    
    const content = modalChild;
    const routeName = (wagon.route) ? wagon.route.toUpperCase() : "THE TRAIL";
    const routeLen = RouteDistances[wagon.route] || 2170;
    const lenPct = ((routeLen / 2170) * 100).toFixed(0);
    
    const finalScore = wagon.buildScore();
    const playerName = (wagon.characters[0] && wagon.characters[0].name) ? wagon.characters[0].name : "Ghost Pioneer";

    window.pendingScore = { score: finalScore, defaultName: playerName, recorded: false };

    if (reachedDestination) {
        if (wagon.challengeMode === 'ghost' && wagon.ghostRace) {
            const beat = wagon.days < wagon.ghostRace.days;
            const margin = Math.abs(wagon.ghostRace.days - wagon.days);
            const raceMsg = beat
                ? `👻 You beat ${wagon.ghostRace.name}'s phantom by ${margin} day${margin === 1 ? '' : 's'}!`
                : (wagon.days === wagon.ghostRace.days
                    ? `👻 A dead heat with ${wagon.ghostRace.name}'s phantom. Spooky.`
                    : `👻 ${wagon.ghostRace.name}'s phantom finished ${margin} day${margin === 1 ? '' : 's'} ahead of you.`);
            eventLog.insertAdjacentHTML('afterbegin', `<span style="color:#9be7ff;">${raceMsg}</span><br>`);
            if (beat) AchievementManager.unlock('ghost_buster', 'Ghost Buster');
        }
        saveGhostRun();
    }

    if (reachedDestination) {
        const trailName = wagon.route;
        const prof = wagon.professionName;
        const isHard = (wagon.difficulty === "Hard" || wagon.difficulty === "New Game+");
		AudioManager.playVictoryBGM();

        // Whatever the Bigfoot Talisman and the dog look like right now, this is what a future New Game+ run will start with.
        snapshotNewGamePlusCarryover();
        
        // Cumulative Stats
        if (!AchievementManager.data.stats.trailsCompleted.includes(trailName)) {
            AchievementManager.data.stats.trailsCompleted.push(trailName);
        }
        if (isHard && !AchievementManager.data.stats.hardTrailsCompleted.includes(trailName)) {
            AchievementManager.data.stats.hardTrailsCompleted.push(trailName);
        }
        if (!AchievementManager.data.stats.professionsUsed.includes(prof)) {
            AchievementManager.data.stats.professionsUsed.push(prof);
        }
        
        // Check Unlocks
        if (trailName === "Oregon") AchievementManager.unlock('river_master', 'River Master');
        if (trailName === "Mormon") AchievementManager.unlock('congregation', 'Congregation Complete');
        if (trailName === "California") AchievementManager.unlock('49er', "I'm a 49er");
        if (trailName === "Santa Fe") AchievementManager.unlock('trader_joe', 'Trader Joe');
        if (trailName === "Bozeman") AchievementManager.unlock('bulletproof', 'Bulletproof');
        if (trailName === "UNO Reverse") AchievementManager.unlock('reverse_card', 'Reverse Card!');
        if (trailName === "Random") AchievementManager.unlock('random_encounter', 'Random Encounter');
        if (trailName === "California" && prof === "Prospector") AchievementManager.unlock('on_brand', 'On Brand');
        if (wagon.challengeMode === 'nudist') AchievementManager.unlock('nekkid', 'Nekkid');
        if (wagon.challengeMode === 'luddite') AchievementManager.unlock('off_the_grid', 'Off the Grid');
        if (wagon.challengeMode === 'winter') AchievementManager.unlock('snowbird', 'Snowbird');
        if (wagon.challengeMode === 'ghost') AchievementManager.unlock('phantom_chaser', 'Phantom Chaser');
        if (wagon.challengeMode === 'vegetarian') AchievementManager.unlock('garden_variety', 'Garden Variety');
        if (wagon.challengeMode === 'ramsey') AchievementManager.unlock('debt_free_scream', 'Debt-Free Scream');
        if (wagon.challengeMode === 'nosave') AchievementManager.unlock('no_scummin', "No Scummin'");
        if (wagon.dailyChallenge) AchievementManager.unlock('creature_of_habit', 'Creature of Habit');
        
        // 7 completable trails: the original 5 plus UNO Reverse and Random.
        // (Ironman doesn't count — it's endless and never reaches this branch.)
        if (AchievementManager.data.stats.hardTrailsCompleted.length >= 7) {
            AchievementManager.unlock('guitar_hero', 'On a Guitar Controller');
        }
        if (AchievementManager.data.stats.professionsUsed.length >= 13) {
            AchievementManager.unlock('jobby_job', 'Jobby Job');
        }

        if (wagon.characters.every(c => c.status !== "Dead")) {
            AchievementManager.unlock('full_lives', 'Full Lives');
        }
		
        if (wagon.days < 50) {
            AchievementManager.unlock('speedrunner', 'Speedrunner');
        }

        if (AchievementManager.data.stats.animalsHuntedThisRun === 0) {
            AchievementManager.unlock('pacifist', 'Pacifist');
        }
	    
        // IMPORTANT: Reset run-specific stats after win
        AchievementManager.data.stats.tombstonesMourned = 0;
        AchievementManager.data.stats.animalsHuntedThisRun = 0;
        AchievementManager.save();

        content.innerHTML = `
        <div style="text-align:center; background:#000; color:gold; padding:20px; border:5px double gold; font-family:'Rye';">
            <h1 style="margin:0;">DESTINATION REACHED: ${wagon.route.toUpperCase()}</h1>
            <img src="./img/landmarks/${Landmarks[wagon.currentLandmark].num}-screen.png" style="width:100%; border:2px solid gold; margin:10px 0;">
            
            <div style="background:rgba(255,255,255,0.1); padding:10px; text-align:left; font-size:0.8em; color:white;">
                <p>SURVIVORS: ${wagon.characters.length} x 500pts</p>
                <p>JUNK COLLECTED: ${wagon.junk} x 150pts</p>
                <p>TRAIL DIFFICULTY (Length): ${lenPct}%</p>
                <p style="border-top:1px solid #555;">PROFESSION MULTIPLIER: x${wagon.scoreBonus}</p>
            </div>
	    
            <h2 style="font-size:2em; margin:10px 0;">FINAL SCORE: ${finalScore}</h2>
            <div class="buttons">
                <button ${actionAttrs('promptScoreName')} class="btn btn-warning">RECORD SCORE</button>
                <button ${actionAttrs('showLeaderboardUI')} class="btn btn-info">VIEW LEADERBOARD</button>
                <button ${actionAttrs('reloadPage')} class="btn btn-success">NEW GAME</button>
            </div>
        </div>`;
        if (wagon.flags && wagon.flags.cheated) {
            const scoreEl = content.querySelector("h2");
            if (scoreEl) scoreEl.insertAdjacentHTML('beforebegin',
                "<p style='color:yellow; font-weight:bold;'>[CHEATER DETECTED]: Your score has been voided for cheating.</p>"
            );
        }
    } else {
        AudioManager.playSound('gameover');
		AchievementManager.unlock('dead', 'Unalived');
        
        // Dynamic Failure Messages
        let failureTitle = "JOURNEY ENDED";
        let failureMsg = "You didn't quite make it to the end of the trail.";

        if (wagon.route === "Oregon") {
            failureTitle = "RAFT DESTROYED";
            failureMsg = "Your wagon-raft was smashed to pieces by the rocks. The trail ends here.";
        } else if (wagon.route === "California") {
            failureTitle = "FROZEN IN TIME";
            failureMsg = "The snow became too deep and the cold too intense. Your party has become a permanent landmark in Donner Pass.";
        } else if (wagon.route === "Mormon") {
            failureTitle = "CONGREGATION DISPERSED";
            failureMsg = "Between the tar, feathers, and lack of followers, your dream of a Salt Lake city has vanished.";
        } else if (wagon.route === "Santa Fe") {
            failureTitle = "IPO FAILURE";
            failureMsg = "Your angel investors pulled out and all the tech bros have ghosted you.";
        } else if (wagon.route === "Bozeman") {
            failureTitle = "PARTY UNALIVED";
            failureMsg = "You dared to travel the path of bullet hell. Death was to expected.";
        } else {
            failureTitle = "NOT APPEARING IN THIS GAME";
            failureMsg = "You should not be seeing this message, you haxx0rz.";
        }

        content.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h1 style="color:red;">${failureTitle}</h1>
                <p>${failureMsg}</p>
                <button ${actionAttrs('promptScoreName')} class="btn btn-warning">RECORD SCORE</button>
                <button ${actionAttrs('reloadPage')} class="btn btn-danger">Rethink Your Life</button>
            </div>`;
    }
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

window.scoreSession = window.scoreSession || null;
async function fetchScoreToken() {
    try {
        const r = await fetch('./score.php?action=token');
        if (!r.ok) return;
        const data = await r.json();
        if (data && data.token) window.scoreSession = { token: data.token, issued: Date.now() };
    } catch (e) {
        if (DEBUG) console.log("Token fetch failed (offline play is fine):", e);
    }
}

function promptScoreName() {
    const pending = window.pendingScore;
    if (!pending) { updateActionPrompt("No score waiting to be recorded."); return; }
    if (pending.recorded) { showLeaderboardUI(wagon.dailyChallenge ? 'daily' : true); return; }

    const content = modalChild;
    content.innerHTML = `
        <div style="background: #000; color: #008800; padding: 30px; border: 4px solid #008800; font-family: 'Courier New', monospace; text-align: center;">
            <h2 style="color: gold;">--- FOR THE RECORD ---</h2>
            <p style="margin: 16px 0;">Final score: <strong style="color:gold;">${pending.score.toLocaleString()}</strong></p>
            <p style="margin: 16px 0; color:#aaa; font-size:0.9em;">The telegraph operator squints at "${pending.defaultName}". "That your REAL name, partner?"</p>
            <label style="display: block; margin-bottom: 10px;">NAME FOR THE RECORD BOOKS:</label>
            <input type="text" id="score-name-input" maxlength="20" value="${pending.defaultName.replace(/"/g, '&quot;')}" autofocus
                   style="background: #111; color: #008800; border: 1px solid #008800; padding: 10px; width: 80%; text-align: center; font-size: 1.2rem;">
            <div style="margin-top: 30px; display: flex; justify-content: center; gap: 20px;">
                <button class="btn btn-success" ${actionAttrs('processScoreNameEntry')}>TRANSMIT</button>
                <button class="btn btn-danger" ${actionAttrs('toggleModal', ['#myModal'])}>NOT NOW</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    const input = document.getElementById('score-name-input');
    if (input) {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') processScoreNameEntry(); });
        input.select();
    }
}

function processScoreNameEntry() {
    const pending = window.pendingScore;
    const input = document.getElementById('score-name-input');
    if (!pending || !input) return;
    const name = input.value.trim();
    if (!name) return;

    const isOffensive = badWords.some(word => name.toLowerCase().includes(word.toLowerCase()));
    if (isOffensive) {
        input.style.borderColor = "red";
        input.value = "";
        input.placeholder = "THE OPERATOR REFUSES. TRY AGAIN.";
        AudioManager.playSound('alert');
        return;
    }

    pending.recorded = true;
    saveToLeaderboard(name, pending.score);
    toggleModal("#myModal");
    setTimeout(() => showLeaderboardUI(wagon.dailyChallenge ? 'daily' : true), 500);
}

async function saveToLeaderboard(playerName, finalScore) {
    // Local Save uses playerName
    let localScores = JSON.parse(localStorage.getItem('pioneer_leaderboard')) || DEFAULT_SCORES;
    localScores.push({ 
        name: playerName, 
        score: finalScore, 
        profession: wagon.professionName,
        status: wagon.characters.some(c => c.status !== "Dead") ? "Survived" : "Ghost",
        date: new Date().toLocaleDateString()
    });
    localScores.sort((a, b) => b.score - a.score);
    localStorage.setItem('pioneer_leaderboard', JSON.stringify(localScores.slice(0, 10)));

    // Daily Challenge runs also land on today's daily board (kept per-date, so yesterday's scores don't bleed into today's competition).
    if (wagon.dailyChallenge) {
        const dailyKey = `pioneer_daily_leaderboard_${wagon.dailyChallenge}`;
        let dailyScores = JSON.parse(localStorage.getItem(dailyKey)) || [];
        dailyScores.push({
            name: playerName,
            score: finalScore,
            profession: wagon.professionName,
            status: wagon.characters.some(c => c.status !== "Dead") ? "Survived" : "Ghost",
            date: wagon.dailyChallenge
        });
        dailyScores.sort((a, b) => b.score - a.score);
        try { localStorage.setItem(dailyKey, JSON.stringify(dailyScores.slice(0, 10))); } catch (e) {}
    }

    // Start Global Validation
    checkGlobalName(playerName, finalScore);
}

function checkGlobalName(name, score) {
    const isOffensive = badWords.some(word => name.toLowerCase().includes(word.toLowerCase()));

    if (isOffensive) {
        showGlobalNameModal(score);
    } else {
        submitToPersistentDB(name, score);
    }
}

function showGlobalNameModal(score) {
    const content = document.getElementById('modal-dynamic-content');
    
    content.innerHTML = `
        <div style="background: #000; color: #008800; padding: 30px; border: 4px solid #008800; font-family: 'Courier New', monospace; text-align: center;">
            <h2 style="color: #ff0000; text-shadow: 2px 2px #330000;">--- TELEGRAPH ERROR ---</h2>
            <p style="margin: 20px 0;">The operator at the station refuses to transmit your name! It contains language unfit for the civilized world.</p>
            
            <label style="display: block; margin-bottom: 10px;">ENTER A CLEAN ALIAS FOR THE GLOBAL RECORD:</label>
            <input type="text" id="global-name-input" maxlength="20" autofocus
                   style="background: #111; color: #008800; border: 1px solid #008800; padding: 10px; width: 80%; text-align: center; font-size: 1.2rem;">
            
            <div style="margin-top: 30px; display: flex; justify-content: center; gap: 20px;">
                <button class="btn btn-success" ${actionAttrs('processGlobalNameEntry', [score])}>TRANSMIT</button>
                <button class="btn btn-danger" ${actionAttrs('toggleModal', ['#myModal'])}>FORGET IT</button>
            </div>
            <p style="font-size: 0.7em; margin-top: 20px; color: #666;">Note: This only affects the Global Leaderboard. Your local record remains unchanged.</p>
        </div>
    `;

    // Ensure we see the modal
    if (document.getElementById('myModal').style.display !== "block") {
        toggleModal("#myModal");
    }

    // Add Enter key listener for the input
    document.getElementById('global-name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') processGlobalNameEntry(score);
    });
}

function processGlobalNameEntry(score) {
    const input = document.getElementById('global-name-input');
    const newName = input.value.trim();

    if (!newName) return;

    const isOffensive = badWords.some(word => newName.toLowerCase().includes(word.toLowerCase()));

    if (isOffensive) {
        // Flash the input red for feedback
        input.style.borderColor = "red";
        input.value = "";
        input.placeholder = "STILL OFFENSIVE. TRY AGAIN.";
        AudioManager.playSound('alert');
    } else {
        // Finally clean! Submit and show the leaderboard
        submitToPersistentDB(newName, score);
        toggleModal("#myModal");
        setTimeout(() => showLeaderboardUI(true), 500); // Show global board after submission
    }
}

async function submitToPersistentDB(name, score) {
    const payload = {
        name: name,
        score: score,
        profession: wagon.professionName,
        status: wagon.characters.some(c => c.status !== "Dead") ? "Survived" : "Ghost",
        date: new Date().toLocaleDateString(),
        difficulty: wagon.difficulty,
        // Daily Challenge runs are tagged so the server can bucket them into
        // that day's board, separate from the all-time Hall of Fame.
        mode: wagon.dailyChallenge ? "daily" : (wagon.challengeMode || "standard"),
        challengeDate: wagon.dailyChallenge || null
    };

    // Attach the session token issued at run start (see fetchScoreToken)
    payload.token = (window.scoreSession && window.scoreSession.token) || null;

    try {
        const response = await fetch('./score.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            updateActionPrompt("TELEGRAPH SUCCESS: Your journey is recorded in the Global Hall of Fame.");
            eventLog.insertAdjacentHTML('afterbegin', 
                `<span style="color: #008800;">Global Leaderboard Updated.</span><br>`
            );
        } else if (response.status === 409) {
            updateActionPrompt("The operator shakes his head: a score for today's challenge was already wired from this outpost.");
        } else if (response.status === 422) {
            updateActionPrompt("The operator refuses to transmit that name. Your local record still stands.");
        } else if (response.status === 401) {
            updateActionPrompt("No valid telegraph session — the global record couldn't be wired. Your local record still stands.");
        }
    } catch (error) {
        console.error("Telegraph Lines are down:", error);
    }
}

async function showLeaderboardUI(isGlobal = false) {
    const modal = document.getElementById('myModal');
    let content = document.getElementById('modal-dynamic-content');

	if (!content) {
        if (modalChild) {
            modalChild.innerHTML = `<div id="modal-dynamic-content"></div>`;
            content = document.getElementById('modal-dynamic-content');
        } else {
            console.error("Critical: Modal container layout not found in DOM.");
            return;
        }
    }

    // Three boards share this UI: LOCAL (this browser, all time), GLOBAL
    // (api.php, all time), and DAILY (today's seeded challenge only).
    const isDaily = isGlobal === 'daily';
    const isGlobalTab = isGlobal === true;
    const today = utcTodayString();

    const localScores = JSON.parse(localStorage.getItem('pioneer_leaderboard')) || DEFAULT_SCORES;
    let scores = localScores;

    if (isDaily) {
        // Try the server's daily bucket first; fall back to this browser's
        // own daily entries for today.
        scores = JSON.parse(localStorage.getItem(`pioneer_daily_leaderboard_${today}`)) || [];
        try {
            content.innerHTML = `<div style="text-align:center; color:gold; padding:50px;">RECEIVING TELEGRAPH SIGNAL...</div>`;
            const response = await fetch(`./score.php?mode=daily&date=${today}`);
            if (response.ok) {
                const dailyData = await response.json();
                if (dailyData && dailyData.length > 0) {
                    // Only trust rows actually tagged for today
                    const filtered = dailyData.filter(s => !s.challengeDate || s.challengeDate === today);
                    if (filtered.length > 0) scores = filtered;
                }
            }
        } catch (e) {
            console.error("Daily Fetch Error:", e);
        }
    }
    // Fetch from PHP API if Global is selected
    else if (isGlobalTab) {
        try {
            // Display a quick loading message while fetching
            content.innerHTML = `<div style="text-align:center; color:gold; padding:50px;">RECEIVING TELEGRAPH SIGNAL...</div>`;
            
            const response = await fetch('./score.php');
            if (!response.ok) throw new Error("Telegraph lines down");
            const globalData = await response.json();
            if (globalData && globalData.length > 0) scores = globalData;
        } catch (e) {
            console.error("Global Fetch Error:", e);
            // Fallback to local but notify the user
            updateActionPrompt("Could not reach Global Telegraph. Showing Local records.");
        }
    }

    if (isDaily && scores.length === 0) {
        // Nothing on the board yet -- render a friendly empty state instead
        // of a blank table.
        scores = [];
    }
    let tableHTML = scores.length === 0
        ? `<tr><td colspan="5" style="padding:30px; text-align:center; color:#888;">No pioneers have finished today's challenge yet. Be the first.</td></tr>`
        : scores.map((s, i) => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px 10px;">${i + 1}</td>
            <td style="padding: 12px 10px; min-width: 150px;">
                <span style="color: #00ffff; display: block; font-weight: bold;">${s.name.toUpperCase()}</span>
                <small style="color: #888; font-size: 0.75em;">${s.status.toUpperCase()}</small>
            </td>
            <td style="padding: 12px 10px; font-weight: bold; color: gold;">${s.score.toLocaleString()}</td>
            <td class="mobile-hide" style="padding: 12px 10px; font-size: 0.85em; color: #aaa;">${s.profession}</td>
            <td class="mobile-hide" style="padding: 12px 10px; font-size: 0.85em; color: #666; text-align: right;">${s.date}</td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div style="background: #000; color: gold; padding: 40px; border: 4px double gold; font-family: 'Roboto', sans-serif;">
            <h2 style="text-align: center; margin-bottom: 20px; font-family: 'Rye'; letter-spacing: 2px;">--- ${isDaily ? `DAILY CHALLENGE &#8226; ${today}` : 'HALL OF FAME'} ---</h2>
            
            <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 25px;">
                <button class="btn btn-sm ${(!isGlobalTab && !isDaily) ? 'btn-warning' : 'btn-dark'}" style="padding: 5px 20px;" ${actionAttrs('showLeaderboardUI', [false])}>LOCAL</button>
                <button class="btn btn-sm ${isGlobalTab ? 'btn-warning' : 'btn-dark'}" style="padding: 5px 20px;" ${actionAttrs('showLeaderboardUI', [true], { stopPropagation: true })}>GLOBAL</button>
                <button class="btn btn-sm ${isDaily ? 'btn-warning' : 'btn-dark'}" style="padding: 5px 20px;" ${actionAttrs('showLeaderboardUI', ['daily'], { stopPropagation: true })}>DAILY</button>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid gold; color: #eee; text-transform: uppercase; font-size: 0.8rem;">
                            <th style="padding: 10px;">#</th>
                            <th style="padding: 10px;">Pioneer</th>
                            <th style="padding: 10px;">Score</th>
                            <th style="padding: 10px;" class="mobile-hide">Class</th>
                            <th style="padding: 10px; text-align: right;" class="mobile-hide">Date</th>
                        </tr>
                    </thead>
                    <tbody>${tableHTML}</tbody>
                </table>
            </div>

            <div style="margin-top: 30px; display: flex; justify-content: space-between; gap: 10px;">
                <button ${actionAttrs('reloadPage')} class="btn btn-success" style="flex: 1;">MAIN MENU</button>
            </div>
        </div>
    `;

    modal.style.display = "block";
}

function applyTrailChoice() {
    const trail = document.getElementById("trail-choice").value;
    const inputs = [
        document.getElementById("char1"),
        document.getElementById("char2"),
        document.getElementById("char3"),
        document.getElementById("char4"),
        document.getElementById("char5")
    ];

    if (trail === "California") {
        const firstNames = ["George", "Tamsen", "Jacob", "Elizabeth", "Isaac"];
        inputs.forEach((input, i) => { input.value = `${firstNames[i]} Donner`; });
    } 
    else if (trail === "Mormon") {
        const mormonNames = ["Brig 'em Young", "Sister Wife 1", "Sister Wife 2", "Sister Wife 3", "Sister Wife 4"];
        inputs.forEach((input, i) => { input.value = mormonNames[i]; });
    }
    else if (trail === "Santa Fe") {
        const santaFeNames = ["B.R.I.B.E. Expert", "Sell-out Sam", "Bent's New Manager", "Adobe Photoshop", "Salt-Tae-Fe"];
        inputs.forEach((input, i) => { input.value = santaFeNames[i]; });
    }
    else if (trail === "Bozeman") {
        const bozemanNames = ["Leroy Jenkins", "Aggro Magnet", "Respawn Pending", "Pay-to-Win Paul", "Target Practice"];
        inputs.forEach((input, i) => { input.value = bozemanNames[i]; });
    }
    else if (trail === "UNO Reverse") {
        const reverseNames = ["Nni Yadoloh Cod", "Feal-kao Einna", "Enaj Yram Ytimlac", "Prewt Ttayw", "Kid Rouy Yllib"];
        inputs.forEach((input, i) => { input.value = reverseNames[i]; });
    }
    else if (trail === "Random") {
        const randomNames = ["Deadpool", "Pinkie Pie", "Mad Hatter", "Gir", "Goro Majima"];
        inputs.forEach((input, i) => { input.value = randomNames[i]; });
    }
    else if (trail === "Ironman") {
        const ironmanNames = ["Tony Stark", "Steve Rogers", "Peter Parker", "Natasha Romanoff", "Bruce Banner"];
        inputs.forEach((input, i) => { input.value = ironmanNames[i]; });
    }
    else {
        const defaults = ["Doc Holiday Inn", "Annie Oak-leaf", "Calamity Mary Jane", "Wyatt Twerp", "Billy Your Kid"];
        inputs.forEach((input, i) => { input.value = defaults[i]; });
    }
}

function applyDraftAnimalChoice() {
    const el = document.getElementById("draft-animal-choice");
    if (!el) return;
    const choice = DRAFT_ANIMALS[el.value] ? el.value : "Oxen";
    const cfg = getDraftAnimalConfig(choice);

    const previewImg = document.getElementById("draft-animal-preview-img");
    if (previewImg) previewImg.src = cfg.previewImg;

    if (choice !== "Oxen") {
        showAnimalNamingJoke();
    }
}

function showAnimalNamingJoke() {
    const content = modalChild;
    if (!content) return;
    content.innerHTML = `
        <div style="text-align:center; padding: 24px;">
            <h3>A Note From the Family</h3>
            <p style="font-size:1.15em; margin: 20px 0;">For some reason, your family decided to name all of their animals oxen.</p>
            <button class="btn btn-success" ${actionAttrs('toggleModal', ['#myModal'], { noTitle: true })} title="It's a family tradition. Nobody questions it anymore.">Sure, Why Not</button>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function showMechanicalBullModal() {
    AchievementManager.unlock('eight_seconds', '8 Seconds');
    const tamed = hasSkill("Animal Handling");
    const message = tamed
        ? "You tame and befriend the wild mechanical bull. You come to truly love each other over time. But it still can't pull your wagon."
        : "The bull immediately threw you off, and it is also unable to pull your wagon.";
    const content = modalChild;
    if (!content) return;
    content.innerHTML = `
        <div style="text-align:center; padding: 24px;">
            <h3>🤠 The Mechanical Bull</h3>
            <p style="font-size:1.15em; margin: 20px 0;">${message}</p>
            <button class="btn btn-danger" ${actionAttrs('bullRodeoGameOver', [], { noTitle: true })} title="Well, that was a bold financial decision.">Continue</button>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function bullRodeoGameOver() {
    if (!wagon) return;
    wagon.triggerGameOver("oxen");
}

function startCaliforniaFinale() {
    AudioManager.playShovelingBGM();
	const hasSurvival = hasSkill("Survival");
	const hasRepair = hasSkill("Repair");
	const hasMedical = hasSkill("Medical");
    
    wagon.finaleState = {
        type: "shoveling",
        distance: 0,
        target: 7500,
        warmth: 100, // If this hits 0, you freeze
        isProcessing: true,
        blocks: [],
        speed: 3,
        lastSpawn: 0,
        spawnRate: Math.max(600, Math.round(1200 / difficultyIntensityScale())),
        baseSpawnRate: Math.max(600, Math.round(1200 / difficultyIntensityScale())),
        whiteoutSpawnRate: Math.max(200, Math.round(400 / difficultyIntensityScale())),
        isWhiteout: false,
        whiteoutChance: 0.002, 
        whiteoutTimer: 0,
        missedBlocks: 0, // Frostbite Free requires this to stay 0
        hasMedical: hasMedical
    };

	const s = wagon.finaleState;
	s.frictionBonus = (wagon.professionName === "Gamer" || hasSurvival) ? 4 : 2;
	s.missPenalty = (hasRepair ? 10 : 15) * difficultyIntensityScale();
    renderShovelingUI();
    shovelingLoop();
}

function renderShovelingUI() {
    const content = modalChild;
    const hasSurvival = hasSkill("Survival");
    content.innerHTML = `
        <div id="shovel-game-container" class="mini-game-wrapper" style="background: url('./img/shovel/snow_bg.png'); border: 5px solid #ffffff; image-rendering: pixelated;">
            <img src="./img/wagon_side.gif" id="wagon-player" class="wagon-sprite" style="left: 5%; top: 60%; transform: scaleX(-1); image-rendering: pixelated;">
            
            <div style="position: absolute; top: 2%; left: 2%; color: white; text-shadow: 2px 2px #000; font-family: 'Courier New'; z-index: 100; width: 80%; font-size: 1.8cqw;">
                WARMTH: 
                <div style="width: 25cqw; background: #333; height: 2cqw; display: inline-block; border: 1px solid white; vertical-align: middle;">
                    <div id="warmth-bar" style="width: 100%; height: 100%; background: #00ffff; transition: width 0.1s;"></div>
                </div>
                <br>PROGRESS: <span id="shovel-dist">0</span>m
                ${wagon.professionName === 'Gamer' ? '<br><span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''} 
                ${hasSurvival === true ? '<br><span style="color: cyan; font-size: 1.2cqw;">SURVIVAL SKILL BOOST ACTIVE!</span>' : ''}
            </div>

            <div id="mini-game-msg-area" style="position: absolute; top: 45%; left: 50%; transform: translateX(-50%); width: 85%; background: rgba(0,0,0,0.8); color: #00ffff; border: 1px solid #ffffff; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 2cqw; z-index: 190; pointer-events: none;">
                Keep moving to stay warm and shovel any blocks of snow in your path...
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

// Large center-screen text flash to go with the WebSpeech announcement —
// fully visible for ~650ms, fades over the remaining ~350ms, then removed.
function flashWhiteoutBanner() {
    const container = document.getElementById('shovel-game-container');
    if (!container) return;
    const banner = document.createElement('div');
    banner.textContent = "WHITEOUT";
    banner.style.cssText = `
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        font-size:8cqw; font-weight:bold; color:#fff; text-align:center;
        text-shadow: 0 0 1cqw #fff, 0 0 2cqw #7fdfff, 2px 2px 4px #000;
        letter-spacing: 0.3cqw; z-index:250; pointer-events:none;
        font-family: 'Courier New', monospace;
        opacity: 1; transition: opacity 0.35s ease-in;
    `;
    container.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0'; }, 650);
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 1000);
}

function shovelingLoop() {
    const s = wagon.finaleState;
    if (!s || !s.isProcessing) return;

    s.distance += s.speed;

    // --- DYNAMIC COLD LOGIC ---
    const aliveCount = wagon.characters.length || 1;
    const clothingRatio = wagon.clothing / aliveCount;
    
    let coldDrain = 0.04; // Base drain
    if (clothingRatio >= 2 || wagon.flags.bigfoot_blanket) coldDrain = 0.02; // 2+ sets per person or Bigfoot Blanket
    else if (clothingRatio >= 1) coldDrain = 0.03; // 1+ set per person
    if (s.hasMedical) coldDrain = Math.max(0.01, coldDrain - 0.01);
    
    if (s.isWhiteout) coldDrain *= 2; 
	
    coldDrain *= difficultyIntensityScale();
	s.warmth = Math.max(0, s.warmth - coldDrain);
	
    const container = document.getElementById('shovel-game-container');
    
    if (!s.isWhiteout && Math.random() < s.whiteoutChance) {
        s.isWhiteout = true;
        s.whiteoutTimer = 300; // ~5 seconds at 60fps
        s.spawnRate = s.whiteoutSpawnRate; // Triple-ish the frequency (difficulty-scaled)
        container.classList.add('whiteout-active');
        AudioManager.playSound('thunder'); // Use 'thunder' for a heavy wind gust
        updateActionPrompt(translateSanity("A WHITEOUT BLIZZARD HAS STRUCK! DIG FOR YOUR LIFE!"));
        speakHint("Whiteout");
        flashWhiteoutBanner();
    }

    if (s.isWhiteout) {
        s.whiteoutTimer--;
        if (s.whiteoutTimer <= 0) {
            s.isWhiteout = false;
            s.spawnRate = s.baseSpawnRate; // Reset to the difficulty-scaled normal rate, not a flat 1200
            container.classList.remove('whiteout-active');
            updateActionPrompt(translateSanity("The winds have died down... for now."));
        }
    }

    // Update UI
    const bar = document.getElementById('warmth-bar');
    if (bar) bar.style.width = `${s.warmth}%`;
    const distText = document.getElementById('shovel-dist');
    if (distText) distText.textContent = Math.floor(s.distance / 10);
    
    if (container) {
        if (s.warmth < 10) {
            container.classList.add('freezing-effect');
            if (Math.random() < 0.012) {
                const direLines = [
                    "The more you freeze, the tastier your family looks.",
                    "You catch yourself eyeing your travel companions like a dinner menu.",
                    "Someone just asked if you prefer dark meat or white meat. You don't remember who.",
                ];
                updateActionPrompt(translateSanity(direLines[Math.floor(Math.random() * direLines.length)]));
            }
        } else if (s.warmth < 20) {
            container.classList.add('freezing-effect');
            // Randomly update prompt to show the player is shivering
            if (Math.random() < 0.01) updateActionPrompt(translateSanity("Y-y-you can't f-f-feel your toes."));
        } else {
            container.classList.remove('freezing-effect');
        }
        container.style.backgroundPositionX = `${+(s.distance * 0.1)}%`;
    }

    // Spawn and collision logic
    if (Date.now() - s.lastSpawn > s.spawnRate) {
        spawnSnowBlock();
        s.lastSpawn = Date.now();
    }

    for (let i = s.blocks.length - 1; i >= 0; i--) {
        let block = s.blocks[i];
        if (block.shoveled) { s.blocks.splice(i, 1); continue; }

        if (block.type === "standard") {
            block.left -= (s.speed * 0.1); // Move by percentage steps
            block.el.style.left = `${block.left}%`;
            // Responsive collision: Wagon is at 5% to ~24% width
            if (block.left < 20 && block.left > 2) triggerSnowCollision(i);
        } else if (block.type === "crate") {
            // Same parachute physics as falling snow, but a crate you never
            // reach is just a crate you never reach — no damage, no
            // consequence, purely a missed bonus.
            block.top += 1.0;
            block.left -= block.wind;
            block.el.style.top = `${block.top}%`;
            block.el.style.left = `${block.left}%`;
        } else {
            block.top += 1.0; // Fall speed in %
            block.left -= block.wind;
            block.el.style.top = `${block.top}%`;
            block.el.style.left = `${block.left}%`;
            
            // Detection window for falling blocks
            if (block.top > 55 && block.top < 75 && block.left > 2 && block.left < 22) {
                triggerSnowCollision(i);
            }
        }

        if (block.left < -20 || block.top > 110) {
            block.el.remove();
            s.blocks.splice(i, 1);
        }
    }

    if (s.warmth <= 0) {
        s.isProcessing = false;
        finalizeJourney(false); 
    } else if (s.distance >= s.target) {
        s.isProcessing = false;
        if ((s.missedBlocks || 0) === 0) AchievementManager.unlock('frostbite_free', 'Frostbite Free');
        wagon.currentLandmark = "Sutter's Fort"; 
        finalizeJourney(true);
    } else requestAnimationFrame(shovelingLoop);
}

function spawnSnowBlock() {
    const container = document.getElementById('shovel-game-container');
    
    const roll = Math.random();
    const isCrate = roll < 0.08;
    const isFalling = !isCrate && roll < 0.30; // existing 30% (now measured against the remaining 92%)

    let el, startX, startY;

    if (isCrate) {
        el = document.createElement('div');
        el.textContent = "\u{1F4E6}"; // 📦 — no sprite asset for this, styled glyph instead
        startX = Math.random() * 60 + 30; // same drift band as regular falling blocks
        startY = -20;
        el.style.cssText = `position:absolute; left:${startX}%; top:${startY}%; width:12.9cqw; height:12.9cqw; font-size:9cqw; line-height:12.9cqw; text-align:center; z-index:60; filter: drop-shadow(0 0 0.3cqw #fc0);`;
        el.dataset.type = "crate";
    } else if (isFalling) {
        el = document.createElement('img');
        el.src = "./img/shovel/snow_block.png";
        // Falling blocks: Random horizontal percentage
        startX = Math.random() * 60 + 30; // 30% to 90%
        startY = -20; // Start above top edge (%)
        el.style.cssText = `position:absolute; left:${startX}%; top:${startY}%; width:12.9cqw; z-index:60; 
                            filter: saturate(5) brightness(0.8) contrast(1.2);`; 
        el.dataset.type = "falling";
    } else {
        el = document.createElement('img');
        el.src = "./img/shovel/snow_block.png";
        // Ground blocks: Start off-screen right (%)
        startX = 110; 
        startY = 65; // Ground line percentage
        el.style.cssText = `position:absolute; left:${startX}%; top:${startY}%; width:12.9cqw; z-index:60;`;
        el.dataset.type = "standard";
    }
    
    const blockObj = { 
        el: el, 
        shoveled: false, 
        type: el.dataset.type,
        top: startY,
        left: startX,
        // Proportional wind drift (crates parachute-drift the same as falling snow)
        wind: (isFalling || isCrate) ? (Math.random() * 0.4 + 0.1) * (Math.random() < 0.5 ? -1 : 1) : 0 
    };

    el.onclick = () => {
        if (blockObj.shoveled) return;
        blockObj.shoveled = true;
        el.remove();
        if (isCrate) {
            // Real supplies, not warmth — a genuinely different reward for
            // a genuinely different (and riskier, since it means looking
            // away from the path) click.
            const giveFood = Math.random() < 0.6;
            if (giveFood) {
                const amt = 10 + Math.floor(Math.random() * 11);
                wagon.food += amt;
                updateActionPrompt(translateSanity(`Supply crate! +${amt} lbs of food.`));
            } else {
                const amt = 2 + Math.floor(Math.random() * 3);
                wagon.clothing += amt;
                updateActionPrompt(translateSanity(`Supply crate! +${amt} sets of clothing.`));
            }
            AudioManager.playSound('gold');
            textUpdateUI();
        } else {
            wagon.finaleState.warmth = Math.min(100, wagon.finaleState.warmth + (wagon.finaleState.frictionBonus || 2));
            AudioManager.playSound('snow');
        }
    };

    container.appendChild(el);
    wagon.finaleState.blocks.push(blockObj);
}

function triggerSnowCollision(index) {
    const s = wagon.finaleState;
	s.warmth = Math.max(0, s.warmth - (s.missPenalty || 15)); // Repair softens this; scaled by difficulty
    s.missedBlocks = (s.missedBlocks || 0) + 1; // Frostbite Free requires this to stay 0
    
    // Remove the block
    if (s.blocks[index]) {
        s.blocks[index].el.remove();
        s.blocks.splice(index, 1);
    }

    AudioManager.playSound('miss');
    shakeElement('shovel-game-container');
    
    // Briefly slow down the wagon
    const originalSpeed = s.speed;
    s.speed = 1;
    setTimeout(() => { if (s) s.speed = originalSpeed; }, 1000);
}

function startMormonFinale() {
    AudioManager.playMormonBGM();

    const hasTrade = hasSkill("Trade");
    const hasSurvival = hasSkill("Survival");
    const hasRepair = hasSkill("Repair");
    const isStormy = !!(wagon.isSnowing || wagon.hasWater);
    
    wagon.finaleState = {
        type: "mormon_catch",
        distance: 0,
        target: 7500,
        congregation: 100,
        isProcessing: true,
        blocks: [],
        speed: 3,
        lastSpawn: 0,
        spawnRate: 1000,
        midSpawnRate: Math.max(300, Math.round(700 / difficultyIntensityScale())),
        lateSpawnRate: Math.max(150, Math.round(400 / difficultyIntensityScale())),
        isStormy: isStormy,
        catchZoneWidth: hasSurvival ? 24 : 19.4,
        tarSpeedPenalty: hasRepair ? 1.5 : 0.5, // the speed the wagon drops TO after a tar hit — higher is a softer penalty
        titheDiscount: hasTrade ? 0.7 : 1.0, // multiplies the 10%-of-cash cost
        tarHits: 0, // True Believer requires this to stay 0
        globalWind: { strength: 0.1 + Math.random() * 0.15, direction: Math.random() < 0.5 ? -1 : 1 },
        lastWindShift: Date.now(),
        windShiftInterval: 3000 + Math.random() * 2000
    };
    wagon.finaleState.speed *= difficultyIntensityScale();

    renderMormonUI();
    mormonLoop();
}

function renderMormonUI() {
    const content = modalChild;
    const s = wagon.finaleState;
    const hasSurvival = hasSkill("Survival");
    const hasRepair = hasSkill("Repair");
    const hasTrade = hasSkill("Trade");
    const tithePct = Math.round(10 * s.titheDiscount);

    const stormOverlay = s.isStormy
        ? `<div style="position:absolute; top:0; left:0; right:0; height:38%; z-index:80; pointer-events:none; background:linear-gradient(to bottom, rgba(220,225,235,0.75) 0%, rgba(220,225,235,0.35) 60%, transparent 100%);"></div>`
        : '';

    content.innerHTML = `
        <div id="mormon-game-container" class="mini-game-wrapper" 
             style="background: url('./img/mormon/utah_bg.png'); border: 5px solid #ffd700;">
            
            <img src="./img/wagon_side.gif" id="wagon-player" class="wagon-sprite" 
                 style="left: 8%; top: 60%; transform: scaleX(-1);">
            ${stormOverlay}
            
            <div id="mormon-hud" style="position: absolute; top: 2%; left: 2%; color: white; text-shadow: 2px 2px #000; font-family: 'Courier New'; z-index: 100; font-size: 2cqw;">
                CONGREGATION: 
                <div style="width: 25cqw; background: #333; height: 2cqw; display: inline-block; border: 1px solid gold; vertical-align: middle;">
                    <div id="congregation-bar" style="width: 100%; height: 100%; background: #ffd700; transition: width 0.1s;"></div>
                </div>
                <br>PROGRESS TO SALT LAKE: <span id="mormon-dist">0</span>m
                <br><button ${actionAttrs('payTithe')} class="btn btn-warning" style="margin-top: 0.5cqw; font-size: 1.2cqw; padding: 0.5cqw 1cqw;">PAY TITHE (${tithePct}% Cash)</button>
                ${wagon.professionName === 'Gamer' ? '<br><span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''}
                ${hasSurvival ? '<br><span style="color: cyan; font-size: 1.2cqw;">SURVIVAL SKILL BOOST ACTIVE!</span>' : ''}
                ${hasRepair ? '<br><span style="color: cyan; font-size: 1.2cqw;">REPAIR SKILL BOOST ACTIVE!</span>' : ''}
                ${hasTrade ? '<br><span style="color: cyan; font-size: 1.2cqw;">TRADE SKILL BOOST ACTIVE!</span>' : ''}
                ${s.isStormy ? '<br><span style="color: #a0c8ff; font-size: 1.2cqw;">STORM: reduced visibility, faster spawns</span>' : ''}
            </div>

            <div id="mini-game-msg-area" style="position: absolute; bottom: 5%; left: 50%; transform: translateX(-50%); width: 85%; background: rgba(0,0,0,0.8); color: #ffd700; border: 1px solid gold; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 2cqw; z-index: 190; pointer-events: none;">
                Position the wagon to catch what you want — Arrow Keys, A/D<span class="dpad-hint">, or the controls below</span>. Don't grab the tar.
            </div>

            <div id="mormon-dpad" class="dpad-touch-controls dpad-flex" style="position:absolute; bottom:3%; right:3%; z-index:150; gap:1cqw; user-select:none;">
                <button id="mormon-dpad-left" style="width:11cqw; height:9cqw; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid gold; border-radius:8px; touch-action:none;">&#9664;</button>
                <button id="mormon-dpad-right" style="width:11cqw; height:9cqw; font-size:3cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid gold; border-radius:8px; touch-action:none;">&#9654;</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    bindMormonDpad();
}

function bindMormonDpad() {
    const bind = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (e) => { e.preventDefault(); keys[keyName] = true; };
        const release = (e) => { e.preventDefault(); keys[keyName] = false; };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release);
        btn.addEventListener('touchcancel', release);
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };
    bind('mormon-dpad-left', 'ArrowLeft');
    bind('mormon-dpad-right', 'ArrowRight');
}

function payTithe() {
    const s = wagon.finaleState;
    if (!s || !s.isProcessing || wagon.money <= 0) return;

    // Trade had no role in this finale before — a discount on the one
    // purchasable safety valve no other finale has an equivalent of.
    const cost = wagon.money * 0.10 * (s.titheDiscount || 1.0);
    wagon.money -= cost; // Safeguarded by the check above
    
    s.congregation = Math.min(100, s.congregation + 25);
    
    AudioManager.playSound('gold');
    updateActionPrompt(translateSanity(`You paid a tithe of $${cost.toFixed(2)}. Faith is restored!`));
    textUpdateUI();
}

function spawnMormonObject(progressPct) {
    const container = document.getElementById('mormon-game-container');
    const el = document.createElement('img');
    const roll = Math.random();
    const windScale = 0.5 + (progressPct * 1.0); 

    let type = "wife";
    let src = "./img/mormon/sister_wife.png";
    if (roll < 0.3) { type = "tar"; src = "./img/mormon/tar_feathers.png"; }
    else if (roll > 0.95) { type = "book"; src = "./img/mormon/book_mormon.png"; }

    // Spawn between 10% and 90% of the container width
    const startX = Math.random() * 80 + 10; 
    el.src = src;
    // Set width to 9.7cqw for responsive scaling
    el.style.cssText = `position:absolute; left:${startX}%; top:-20%; width:9.7cqw; z-index:60;`;
    
    const randomDirection = Math.random() < 0.5 ? -1 : 1;
    const windVariance = (Math.random() * 0.08) * randomDirection * windScale;

    const obj = { 
        el: el, 
        caught: false, 
        type: type, 
        top: -20, // Starting percentage height
        left: startX, 
        windVariance: windVariance,
        tarWarned: false
    };
	
    el.onclick = () => {
        if (obj.caught) return;
        if (obj.type === "tar") {
            if (!obj.tarWarned) {
                obj.tarWarned = true;
                updateActionPrompt(translateSanity("That's not for grabbing — steer the wagon clear of it!"));
            }
            return;
        }
        obj.caught = true;
        if (obj.type === "wife") {
            wagon.finaleState.congregation = Math.min(100, wagon.finaleState.congregation + 10);
            updateActionPrompt(translateSanity("You welcomed a new follower to the flock!"));
			AudioManager.playSound('I_do');
        } else if (obj.type === "book") {
            wagon.books += 2; // Permanent score boost
            updateActionPrompt(translateSanity("You secured rare scripture! Score multiplier increasing."));
            AudioManager.playSound('amen');
        }
        el.remove();
        AudioManager.playSound('takethetrade');
    };

    container.appendChild(el);
    wagon.finaleState.blocks.push(obj);
}

function mormonLoop() {
    const s = wagon.finaleState;
    if (!s || !s.isProcessing) return;

    const progressPct = s.distance / s.target;
    const stormMult = s.isStormy ? 0.82 : 1.0;
    let phaseSpawnRate = 1000; // early-game baseline, matches the original flat value
    if (progressPct > 0.8) phaseSpawnRate = s.lateSpawnRate;
    else if (progressPct > 0.5) phaseSpawnRate = s.midSpawnRate;
    s.spawnRate = Math.max(150, Math.round(phaseSpawnRate * stormMult));

    if (Date.now() - s.lastWindShift > s.windShiftInterval) {
        const range = s.isStormy ? [0.15, 0.55] : [0.05, 0.35];
        s.globalWind = {
            strength: range[0] + Math.random() * (range[1] - range[0]),
            direction: Math.random() < 0.5 ? -1 : 1
        };
        s.lastWindShift = Date.now();
        s.windShiftInterval = 3000 + Math.random() * 2000;
    }

    // ARROW KEY MOVEMENT (Percentage Based)
    const wagonEl = document.getElementById('wagon-player');
    let currentLeft = parseFloat(wagonEl.style.left) || 8;
    if ((keys["ArrowLeft"] || keys["a"] || keys["A"] || gamepadState.left) && currentLeft > 2) currentLeft -= 1.5;
    if ((keys["ArrowRight"] || keys["d"] || keys["D"] || gamepadState.right) && currentLeft < 75) currentLeft += 1.5;
    wagonEl.style.left = `${currentLeft}%`;

    s.distance += s.speed;
    const bar = document.getElementById('congregation-bar');
    if (bar) bar.style.width = `${s.congregation}%`;
    
    const distText = document.getElementById('mormon-dist');
    if (distText) distText.textContent = Math.floor(s.distance / 10);
    const container = document.getElementById('mormon-game-container');
    container.style.backgroundPositionX = `${+(s.distance * 0.1)}%`; // Responsive scroll

    if (Date.now() - s.lastSpawn > s.spawnRate) {
        spawnMormonObject(progressPct);
        s.lastSpawn = Date.now();
    }

    for (let i = s.blocks.length - 1; i >= 0; i--) {
        let obj = s.blocks[i];
        if (obj.caught) { s.blocks.splice(i, 1); continue; }

        obj.top += 1.2; 
        obj.left -= (s.globalWind.strength * s.globalWind.direction + obj.windVariance);
        obj.el.style.top = `${obj.top}%`;
        obj.el.style.left = `${obj.left}%`;

        if (obj.top > 55 && obj.top < 75 && 
            obj.left > currentLeft && obj.left < (currentLeft + s.catchZoneWidth)) {
                
            if (obj.type === "tar") {
				s.congregation = Math.max(0, s.congregation - 30);
                wagon.money = Math.max(0, wagon.money - 5); 
                s.tarHits = (s.tarHits || 0) + 1; // True Believer requires this to stay 0
                const normalSpeed = 3 * difficultyIntensityScale();
                s.speed = s.tarSpeedPenalty;
                setTimeout(() => { if (s) s.speed = normalSpeed; }, 2000);
                
                AudioManager.playSound('miss');
                shakeElement('mormon-game-container');
                updateActionPrompt(translateSanity("TARRED! You lost $5 and some followers."));
            } else if (obj.type === "wife") {
                s.congregation = Math.min(100, s.congregation + 15);
                AudioManager.playSound('I_do');
                updateActionPrompt(translateSanity("Another sister-wife joins the Congregation!"));
            } else if (obj.type === "book") {
                wagon.books += 2;
                AudioManager.playSound('amen');
                updateActionPrompt(translateSanity("You secured rare scripture! Score multiplier increasing."));
            }
            obj.el.remove();
            s.blocks.splice(i, 1);
            continue; // Move to next item
        }

        // Cleanup & Miss Penalty
        if (obj.left < -20 || obj.left > 120 || obj.top > 100) {
            if (obj.top >= 100 && obj.type === "wife") {
				s.congregation = Math.max(0, s.congregation - 20);
                const foodLoss = Math.floor(wagon.food * 0.25);
                wagon.food -= foodLoss;
                updateActionPrompt(translateSanity(`A potential follower left and took ${foodLoss} lbs of food! She is also demanding a TLC spin-off!`));
            }
            obj.el.remove();
            s.blocks.splice(i, 1);
        }
    }

    if (s.congregation <= 0) {
		s.isProcessing = false;
		finalizeJourney(false);
	} else if (s.distance >= s.target) {
		s.isProcessing = false;
		if ((s.tarHits || 0) === 0) AchievementManager.unlock('true_believer', 'True Believer');
		wagon.currentLandmark = "Salt Lake Valley";
		finalizeJourney(true);
	} 
    else requestAnimationFrame(mormonLoop);
}

function startSantaFeFinale() {
    AudioManager.playSantaFeBGM();
    
    const isGamer = (wagon.professionName === "Gamer");
    const hasSurvival = hasSkill("Survival");
    const hasMedical = hasSkill("Medical");
    const baseSpeed = isGamer ? 2 : 3;
    const isStormy = !!(wagon.isSnowing || wagon.hasWater);

    wagon.finaleState = {
        type: "logistics",
        distance: 0,
        target: 7500,
        revenue: 0,
        goal: Math.round(500 * difficultyIntensityScale()),
        isProcessing: true,
        customers: [],
        speed: baseSpeed, // Slower for Gamers
        lastSpawn: 0,
        spawnRate: isGamer ? 3000 : 2000,
        midSpawnRate: Math.round(Math.max(600, Math.round(1200 / difficultyIntensityScale())) * (isStormy ? 1.3 : 1.0)),
        lateSpawnRate: Math.round(Math.max(400, Math.round(800 / difficultyIntensityScale())) * (isStormy ? 1.3 : 1.0)),
        isStormy: isStormy,
        offerMult: isStormy ? 1.25 : 1.0,
        customerMoveMult: hasSurvival ? 0.7 : 1.0,
        missSanityPenalty: hasMedical ? 1 : 2,
        selectedItem: null
    };
    wagon.finaleState.speed *= difficultyIntensityScale();

    renderSantaFeUI();
    santaFeLoop();
}

function renderSantaFeUI() {
    const hasTrade = hasSkill("Trade");
    const hasSurvival = hasSkill("Survival");
    const hasMedical = hasSkill("Medical");
    const s = wagon.finaleState;
	const content = modalChild;
    content.innerHTML = `
        <div id="santafe-game-container" class="mini-game-wrapper" style="background: url('./img/santafe/desert_road.png'); border: 5px solid #ffd700;">
		
		<div id="mini-game-msg-area" style="position: absolute; top: 40%; left: 50%; transform: translateX(-50%); width: 80%; background: rgba(0,0,0,0.7); color: #ffff00; border: 1px solid #ffd700; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 1.5cqw; z-index: 190; pointer-events: none;">
                Select cargo to begin trading...
            </div>
			
            <img src="./img/wagon_side.gif" id="wagon-player" class="wagon-sprite" 
                 style="left: 5%; top: 60%; transform: scaleX(-1);">
            
            <div style="position: absolute; top: 3%; left: 3%; color: white; text-shadow: 2px 2px #000; font-family: 'Courier New'; font-size: 2.5cqw; z-index: 100;">
                REVENUE: <span id="sf-rev-val" style="color: #00A000;">$${s.revenue}</span> / $${s.goal}
                <br>DIST: <span id="sf-dist">0</span>m
				${wagon.professionName === 'Gamer' ? '<br><span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''}${hasTrade === true ? '<br><span style="color: cyan; font-size: 1.2cqw;"> TRADE SKILL BOOST ACTIVE!</span>' : ''}
                ${hasSurvival ? '<br><span style="color: cyan; font-size: 1.2cqw;">SURVIVAL SKILL BOOST ACTIVE!</span>' : ''}
                ${hasMedical ? '<br><span style="color: cyan; font-size: 1.2cqw;">MEDICAL SKILL BOOST ACTIVE!</span>' : ''}
                ${s.isStormy ? '<br><span style="color: #a0c8ff; font-size: 1.2cqw;">STORM: fewer travelers, better prices</span>' : ''}
            </div>

            <div id="cargo-bay" style="position: absolute; bottom: 3%; left: 50%; transform: translateX(-50%); display: flex; gap: 1cqw; z-index: 150;">
                </div>
        </div>
    `;
    updateSantaFeHUD();
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
}

function spawnCustomer() {
    const container = document.getElementById('santafe-game-container');
    const el = document.createElement('div');
    const items = ["food", "bullets", "junk", "clothing"]; 
    const desire = items[Math.floor(Math.random() * items.length)];
    const baseOffer = { food: 20, bullets: 15, junk: 50, clothing: 35 }[desire];
    const offer = Math.round(baseOffer * (wagon.finaleState.offerMult || 1.0));

    el.className = "customer-npc";
    // Anchor to ground line (top: 60%)
    el.style.cssText = `position:absolute; left:110%; top:50%; width:12.9cqw; height:20cqw; z-index:45; cursor:pointer;`;
    
    el.innerHTML = `
        <div class="price-tag" style="position:absolute; top:-15%; left:10%; background:rgba(0,0,0,0.8); border:1px solid gold; padding:2px; text-align:center; width:80%; transition: background 0.2s, border-color 0.2s;">
            <img src="./img/santafe/icon_${desire.toLowerCase()}.png" class="desire-icon" style="image-rendering:pixelated;">
            <div style="color:gold; font-size:1.5cqw;">$${offer}</div>
        </div>
        <img src="./img/santafe/trader_npc.png" style="width:100%; position:absolute; bottom:0;">
    `;

    const obj = { el: el, desire: desire, offer: offer, left: 110, fulfilled: false, priceTagEl: el.querySelector('.price-tag'), urgent: false };
    el.onclick = (e) => { e.stopPropagation(); if (!obj.fulfilled) attemptDelivery(obj); };

    container.appendChild(el);
    wagon.finaleState.customers.push(obj);
}

function selectCargo(item) {
    wagon.finaleState.selectedItem = item;
    updateActionPrompt(translateSanity(`Ready to trade ${item.toUpperCase()}. Click a customer to sell!`));
}

function attemptDelivery(customer) {
    const s = wagon.finaleState;
    if (!s.selectedItem) {
        updateActionPrompt(translateSanity("Select cargo from the bay first!"));
        return;
    }

    if (s.selectedItem === customer.desire) {
        let hasItem = false;
        if (s.selectedItem === "food" && wagon.food >= 50) { wagon.food -= 50; hasItem = true; }
        else if (s.selectedItem === "bullets" && wagon.bullets >= 20) { wagon.bullets -= 20; hasItem = true; }
        else if (s.selectedItem === "junk" && wagon.junk >= 1) { wagon.junk -= 1; hasItem = true; }
        else if (s.selectedItem === "clothing" && wagon.clothing >= 1) { wagon.clothing -= 1; hasItem = true; }

        if (hasItem) {
            // TRADE SKILL BONUS: 20% markup
            const isMerchant = hasSkill("Trade");
            const finalProfit = isMerchant ? Math.floor(customer.offer * 1.2) : customer.offer;
            
            s.revenue += finalProfit;
            customer.fulfilled = true;
            
            // Visual feedback: NPC changes color and shows the specific profit
            customer.el.innerHTML = `<img src="./img/santafe/trader_npc.png" style="width:80px; filter: sepia(1) hue-rotate(90deg);">
                                     <div style="color:gold; font-weight:bold; font-size:20px; position:absolute; top:-30px;">+$${finalProfit}</div>`;
            
            AudioManager.playSound('gold');
            updateSantaFeHUD(); // Call the specific update function
        } else {
            updateActionPrompt(translateSanity(`LOGISTICS ERROR: Out of ${s.selectedItem}!`));
        }
    } else {
        AudioManager.playSound('miss');
        speakHint("Trade Failed");
        updateActionPrompt(translateSanity(`They don't want ${s.selectedItem} — try something else.`));
        customer.el.classList.add('apply-shake');
        setTimeout(() => customer.el.classList.remove('apply-shake'), 700);
    }
}

function santaFeLoop() {
    const s = wagon.finaleState;
    if (!s || !s.isProcessing) return;
	
    const progressPct = s.distance / s.target;
    if (progressPct > 0.7) s.spawnRate = s.lateSpawnRate; // Heavier traffic near the city
    else if (progressPct > 0.4) s.spawnRate = s.midSpawnRate;

    s.distance += s.speed;
    document.getElementById('sf-dist').textContent = Math.floor(s.distance / 10);

    const container = document.getElementById('santafe-game-container');
    // Move background proportional to speed
    const bgScroll = (s.distance * 0.1) % 100; 
    container.style.backgroundPositionX = `${+bgScroll}%`;

    if (Date.now() - s.lastSpawn > s.spawnRate) {
        spawnCustomer();
        s.lastSpawn = Date.now();
    }

    for (let i = s.customers.length - 1; i >= 0; i--) {
        let npc = s.customers[i];
		npc.left = Math.max(0, npc.left - (s.speed * 0.1 * (s.customerMoveMult || 1.0)));
        npc.el.style.left = `${npc.left}%`;

        if (!npc.fulfilled && !npc.urgent && npc.left < 15) {
            npc.urgent = true;
            if (npc.priceTagEl) {
                npc.priceTagEl.style.background = 'rgba(180,0,0,0.85)';
                npc.priceTagEl.style.borderColor = '#ff4444';
            }
        }
    
        // Only remove the specific NPC that went off-screen
        if (npc.left < -20) {
            if (!npc.fulfilled) {
                wagon.sanity = Math.max(0, wagon.sanity - (s.missSanityPenalty || 2));
            }
            npc.el.remove();
            s.customers.splice(i, 1); // Splice at 'i' specifically
        }
    }

    if (s.distance >= s.target) {
        s.isProcessing = false;
        // WIN CONDITION: Must have $500 (or the difficulty-scaled goal)
        if (s.revenue >= s.goal) {
            if (s.revenue >= 750) AchievementManager.unlock('trade_route', 'Trade Route');
            wagon.currentLandmark = "Santa Fe";
            finalizeJourney(true);
        } else {
            finalizeJourney(false); // Fail screen for "Bad Business"
        }
    } else {
        requestAnimationFrame(santaFeLoop);
    }
}

function updateSantaFeHUD() {
    const s = wagon.finaleState;
    
    // Update Revenue Text
    const revenueDisplay = document.getElementById('sf-rev-val');
    if (revenueDisplay) revenueDisplay.textContent = `$${s.revenue}`;

    // Update Cargo Buttons (to refresh counts)
    const cargoBay = document.getElementById('cargo-bay');
    if (cargoBay) {
        cargoBay.innerHTML = `
            <button ${actionAttrs('selectCargo', ['food'])} class="btn btn-dark" style="font-size: 1.0em;">🍎 FOOD (${Math.floor(wagon.food)})</button>
            <button ${actionAttrs('selectCargo', ['bullets'])} class="btn btn-dark" style="font-size: 1.0em;">🔫 AMMO (${wagon.bullets})</button>
            <button ${actionAttrs('selectCargo', ['junk'])} class="btn btn-dark" style="font-size: 1.0em;">📦 JUNK (${wagon.junk})</button>
            <button ${actionAttrs('selectCargo', ['clothing'])} class="btn btn-dark" style="font-size: 1.0em;">👕 CLOTHES (${wagon.clothing})</button>
        `;
    }
}

function startBozemanFinale() {
    AudioManager.playBozemanBGM();
    
    // SKILL BUFFS
    const isGamer = (wagon.professionName === "Gamer");
    const hasRepair = hasSkill("Repair");
    const hasTrade = hasSkill("Trade");
    const hasSurvival = hasSkill("Survival");
    const isStormy = !!(wagon.isSnowing || wagon.hasWater);
    
    // Gamers see projectiles 20% slower
    const baseProjectileSpeed = isGamer ? 0.8 : 1.0;
    // Repair skill grants +5 base Armor
    const baseHealth = hasRepair ? 20 : 15;

    wagon.finaleState = {
        type: "bullet_hell",
        wave: 1,
        maxWaves: 5,
        waveTimer: Math.round(20000 * difficultyIntensityScale()),
        lastWaveStart: Date.now(),
        respiteActive: false,
        respiteTimer: 4000, // Slightly longer for the lootbox animation
        health: baseHealth,
        maxHealth: baseHealth,
        isProcessing: true,
        projectiles: [],
        spawnRate: Math.max(300, Math.round(800 / difficultyIntensityScale())),
        lastSpawn: 0,
        speedMultiplier: baseProjectileSpeed,
		distance: 0,
        isStormy: isStormy,
        lootArmorChance: hasTrade ? 0.75 : 0.6,
        laserDrainRate: hasSurvival ? 0.14 : 0.2,
        tookDamage: false // No Microtransactions requires this to stay false
    };
    wagon.finaleState.speedMultiplier *= difficultyIntensityScale();
    if (isStormy) wagon.finaleState.speedMultiplier *= 1.1;

    renderBozemanUI();
    bozemanLoop();
}

function renderBozemanUI() {
    const content = modalChild;
    const s = wagon.finaleState;
    const hasRepair = hasSkill("Repair");
    const hasTrade = hasSkill("Trade");
    const hasSurvival = hasSkill("Survival");

    // Same fog-band treatment as the Mormon finale — visibility loss where
    // projectiles actually spawn from, not just cosmetic tinting.
    const stormOverlay = s.isStormy
        ? `<div style="position:absolute; top:0; left:0; right:0; height:35%; z-index:80; pointer-events:none; background:linear-gradient(to bottom, rgba(220,225,235,0.7) 0%, rgba(220,225,235,0.3) 60%, transparent 100%);"></div>`
        : '';
    
    content.innerHTML = `
        <div id="bozeman-game-container" class="mini-game-wrapper" style="background: url('./img/bozeman/mountain_pass.png'); border: 5px solid #ff0000;">
             
             <div style="position: absolute; top: 10px; right: 20px; color: #ff0000; font-family: 'Londrina Solid'; font-size: 2.5cqw; background: rgba(0,0,0,0.7); padding: 2px 8px; border: 2px solid #ff0000; z-index: 110; transform: rotate(-2deg);">
                ENTER THE WAGON: VALLEY SURVIVORS
            </div>
            
            <img src="./img/wagon_side.gif" id="wagon-player" class="wagon-sprite" 
                 style="left: 10%; top: 60%; transform: scaleX(-1);">
            ${stormOverlay}
            
            <div id="bozeman-hud" style="position: absolute; top: 2%; left: 2%; color: white; text-shadow: 2px 2px #000; font-family: 'Courier New'; z-index: 100; font-size: 2cqw;">
                WAVE: <span id="wave-num">${s.wave}</span>/5 | 
                ARMOR: <span id="wagon-hp">${Math.ceil(s.health)}</span> | 
                TIME: <span id="wave-time">${Math.round(s.waveTimer / 1000)}</span>s
                ${wagon.professionName === 'Gamer' ? '<br><span style="color: cyan; font-size: 1.2cqw;">APM: 402 | PING: 18ms</span>' : ''}
                ${hasRepair ? '<br><span style="color: cyan; font-size: 1.2cqw;">REPAIR BOOST ACTIVE!</span>' : ''}
                ${hasTrade ? '<br><span style="color: cyan; font-size: 1.2cqw;">TRADE SKILL BOOST ACTIVE!</span>' : ''}
                ${hasSurvival ? '<br><span style="color: cyan; font-size: 1.2cqw;">SURVIVAL SKILL BOOST ACTIVE!</span>' : ''}
                ${s.isStormy ? '<br><span style="color: #a0c8ff; font-size: 1.2cqw;">STORM: reduced visibility, faster projectiles</span>' : ''}
            </div>

            <div id="mini-game-msg-area" style="position: absolute; bottom: 2%; left: 50%; transform: translateX(-50%); width: 90%; background: rgba(0,0,0,0.8); color: #00ffff; border: 1px solid #00ffff; padding: 5px; text-align: center; font-family: 'Courier New'; font-size: 2cqw; z-index: 190; min-height: 1.5em; pointer-events: none;">
                System Initialized...
            </div>

            <div id="respite-overlay" style="display:none; position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); color:yellow; font-size:4cqw; text-shadow:3px 3px #000; z-index:150;">
                WAVE CLEAR! REPAIRING...
            </div>

            <div id="bozeman-dpad" class="dpad-touch-controls dpad-grid" style="position:absolute; bottom:3%; right:3%; z-index:150; grid-template-columns:repeat(3, 8cqw); grid-template-rows:repeat(2, 8cqw); gap:1cqw; user-select:none;">
                <button id="bozeman-dpad-up" style="grid-column:2; grid-row:1; font-size:2.6cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #ff0000; border-radius:8px; touch-action:none;">&#9650;</button>
                <button id="bozeman-dpad-left" style="grid-column:1; grid-row:2; font-size:2.6cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #ff0000; border-radius:8px; touch-action:none;">&#9664;</button>
                <button id="bozeman-dpad-down" style="grid-column:2; grid-row:2; font-size:2.6cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #ff0000; border-radius:8px; touch-action:none;">&#9660;</button>
                <button id="bozeman-dpad-right" style="grid-column:3; grid-row:2; font-size:2.6cqw; background:rgba(0,0,0,0.55); color:#fff; border:2px solid #ff0000; border-radius:8px; touch-action:none;">&#9654;</button>
            </div>
        </div>
    `;
    if (!document.querySelector("#myModal").classList.contains('active')) toggleModal("#myModal");
    bindBozemanDpad();
}

function bindBozemanDpad() {
    const bind = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (e) => { e.preventDefault(); keys[keyName] = true; };
        const release = (e) => { e.preventDefault(); keys[keyName] = false; };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release);
        btn.addEventListener('touchcancel', release);
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };
    bind('bozeman-dpad-up', 'ArrowUp');
    bind('bozeman-dpad-down', 'ArrowDown');
    bind('bozeman-dpad-left', 'ArrowLeft');
    bind('bozeman-dpad-right', 'ArrowRight');
}

function spawnBozemanProjectile() {
    const container = document.getElementById('bozeman-game-container');
    const wagonEl = document.getElementById('wagon-player');
    const s = wagon.finaleState;
    const el = document.createElement('img');
    
    const roll = Math.random();
    let type = "bullet";
    let src = "./img/bozeman/proj_bullet.png";
    let size = "4cqw";

    if (roll < 0.3) { type = "arrow"; src = "./img/bozeman/proj_arrow.png"; size = "5cqw"; }
    else if (roll > 0.8) { type = "rock"; src = "./img/bozeman/proj_rock.png"; size = "6cqw"; }

    const startX = 110; 
    const startY = Math.random() * 60 + 20;
    
    // Calculate Target (Wagon Position)
    const wagonTop = parseFloat(wagonEl.style.top) || 60;
    const wagonLeft = parseFloat(wagonEl.style.left) || 10;

    // Calculate Angle (In Radians)
    // We aim slightly ahead of the wagon to make it harder
    const angleRad = Math.atan2(wagonTop - startY, wagonLeft - startX);
    const angleDeg = angleRad * (180 / Math.PI);

    el.src = src;
    el.className = "bozeman-proj";
    
    // Apply Rotation
    // If it's an arrow, rotate it to face the wagon.
    // If it's a rock, we can give it a random starting rotation.
    const rotation = (type === "arrow") ? angleDeg : Math.random() * 360;

    el.style.cssText = `
        position:absolute; 
        left:${startX}%; 
        top:${startY}%; 
        width:${size}; 
        z-index:60; 
        image-rendering:pixelated;
        transform: rotate(${rotation}deg);
    `;
    
    container.appendChild(el);
    
    // Store Velocities
    // Use Cosine and Sine to move the projectile along its angled path
    const speedBase = (Math.random() * 0.5 + 0.5) * s.speedMultiplier;
    s.projectiles.push({ 
        el: el, 
        left: startX, 
        top: startY, 
        vx: Math.cos(angleRad) * speedBase, 
        vy: Math.sin(angleRad) * speedBase,
        type: type
    });
}

function bozemanLoop() {
    const s = wagon.finaleState;
    if (!s || !s.isProcessing) return;

    if (s.respiteActive) {
        requestAnimationFrame(bozemanLoop);
        return;
    }

    s.distance = (s.distance || 0) + (5 * s.speedMultiplier);

    const container = document.getElementById('bozeman-game-container');
    if (container) {
        const bgScroll = (s.distance * 0.1) % 100; 
        container.style.backgroundPositionX = `${+bgScroll}%`;
    }

    const elapsed = Date.now() - s.lastWaveStart;
    const remaining = Math.max(0, Math.ceil((s.waveTimer - elapsed) / 1000));
    
    const timeEl = document.getElementById('wave-time');
    if (timeEl) timeEl.textContent = remaining;

    // --- BOSS LOGIC: FINAL 10 SECONDS OF WAVE 5 ---
    if (s.wave === 5 && remaining <= 10) {
        handleBozemanBoss(remaining);
    }

    if (remaining <= 0) {
        if (s.wave < s.maxWaves) startRespite();
        else {
			s.isProcessing = false; // Matches every other finale-ending branch's state hygiene
			if (!s.tookDamage) AchievementManager.unlock('no_microtransactions', 'No Microtransactions');
			wagon.currentLandmark = "Virginia City";
			finalizeJourney(true);
		}
        return;
    }

    // Wagon Movement (Percent-based)
    const wagonEl = document.getElementById('wagon-player');
    let currentTop = parseFloat(wagonEl.style.top) || 60;
    let currentLeft = parseFloat(wagonEl.style.left) || 10;
    let rawUp    = keys["ArrowUp"]    || keys["w"] || keys["W"] || gamepadState.up;
    let rawDown  = keys["ArrowDown"]  || keys["s"] || keys["S"] || gamepadState.down;
    let rawLeft  = keys["ArrowLeft"]  || keys["a"] || keys["A"] || gamepadState.left;
    let rawRight = keys["ArrowRight"] || keys["d"] || keys["D"] || gamepadState.right;
	
    if (rawUp && currentTop > 20) currentTop -= 1.9;
    if (rawDown && currentTop < 80) currentTop += 1.9;
    if (rawLeft && currentLeft > 2) currentLeft -= 1.9;
    if (rawRight && currentLeft < 40) currentLeft += 1.9;
    wagonEl.style.top = `${currentTop}%`;
    wagonEl.style.left = `${currentLeft}%`;

    // Spawning
    if (Date.now() - s.lastSpawn > s.spawnRate) {
        spawnBozemanProjectile();
        s.lastSpawn = Date.now();
    }

    // Collision
    const wagonRect = wagonEl.getBoundingClientRect();

    for (let i = s.projectiles.length - 1; i >= 0; i--) {
        let p = s.projectiles[i];
        p.left += p.vx * 2.5; // Adjusted for percentage scale
        p.top += p.vy * 2.5;
        
        p.el.style.left = `${p.left}%`;
        p.el.style.top = `${p.top}%`;

        const pRect = p.el.getBoundingClientRect();
        if (wagonRect.left < pRect.right && wagonRect.right > pRect.left &&
            wagonRect.top < pRect.bottom && wagonRect.bottom > pRect.top) {
            
            s.health--;
            s.tookDamage = true; // No Microtransactions requires this to stay false
            document.getElementById('wagon-hp').textContent = s.health;
            AudioManager.playSound('miss');
            shakeElement('bozeman-game-container');
            p.el.remove();
            s.projectiles.splice(i, 1);
			updateActionPrompt(translateSanity(`It hurts when you get hit by projectiles! Who could have seen that coming?`));
            
            if (s.health <= 0) {
                s.isProcessing = false;
                finalizeJourney(false);
                return;
            }
        }
        // Cleanup off-screen
        if (p.left < -10 || p.left > 120 || p.top < -10 || p.top > 110) {
            p.el.remove();
            s.projectiles.splice(i, 1);
        }
    }
    requestAnimationFrame(bozemanLoop);
}

function startRespite() {
    const s = wagon.finaleState;
    if (s.respiteActive) return;
    
    s.respiteActive = true; 
    // Setting isProcessing to false temporarily stops requestAnimationFrame
    s.isProcessing = false; 
    s.wave++;
    
    s.projectiles.forEach(p => p.el.remove());
    s.projectiles = [];

    const overlay = document.getElementById('respite-overlay');
    if (overlay) overlay.style.display = 'block';
    
    setTimeout(() => {
        resolveBozemanLootbox();
    }, 1000);
}

function resolveBozemanLootbox() {
    const s = wagon.finaleState;
    const hasRepair = hasSkill("Repair");
    const container = document.getElementById('bozeman-game-container');
    
    const box = document.createElement('div');
    box.id = "bozeman-loot-reveal";
    box.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); border:4px double gold; padding:20px; z-index:200; text-align:center; width:70%; color:gold; font-family:'Courier New';";
    box.innerHTML = `
        <h2 class="sanity-glitch">MID-LEVEL MICROTRANSACTION</h2>
        <p style="font-size:0.8em; color:#00ffff;">"Pay to Win... or in this case, Pay to Survive!"</p>
        <img src="./img/gather/lootbox.png" style="width:120px; margin:10px;">
        <div id="loot-reward">UNBOXING...</div>
    `;
    container.appendChild(box);

    AudioManager.playSound('lootbox');

    setTimeout(() => {
        const roll = Math.random();
        let rewardMsg = "";
        
        // Trade-scaled now — a merchant's eye for a good deal, even in a
        // satirical microtransaction. Was a flat 60/40 split for everyone.
        if (roll > (1 - (s.lootArmorChance || 0.6))) {
            // ARMOR REPAIR: Repair skill bonus (4 vs 2)
            const repairAmt = hasRepair ? 4 : 2;
            s.health = Math.min(s.maxHealth, s.health + repairAmt);
            rewardMsg = `ARMOR REPAIRED (+${repairAmt})`;
            AudioManager.playSound('shiny');
        } else {
            // JUNK REWARD
            const junkItem = JUNK[Math.floor(Math.random() * JUNK.length)];
            wagon.junk++;
            rewardMsg = `TRASH DROP: ${junkItem}`;
            AudioManager.playSound('sad');
        }

        document.getElementById('loot-reward').textContent = rewardMsg;
        document.getElementById('wagon-hp').textContent = s.health;

        // Difficulty increases for the next wave
        s.spawnRate = Math.max(200, s.spawnRate - 150);
        s.speedMultiplier += 0.2;

        setTimeout(() => {
            box.remove();
            const overlay = document.getElementById('respite-overlay');
            if (overlay) overlay.style.display = 'none';
            
            s.lastWaveStart = Date.now();
            s.lastSpawn = Date.now();
            s.respiteActive = false;
            s.isProcessing = true; // RE-ENABLE processing

            const waveNumEl = document.getElementById('wave-num');
            if (waveNumEl) waveNumEl.textContent = s.wave;	
            const timeEl = document.getElementById('wave-time');
            if (timeEl) timeEl.textContent = (s.waveTimer / 1000);

            updateActionPrompt(translateSanity(`WAVE ${s.wave} START! Focus your 8-bit energy!`));
            
            bozemanLoop(); 
        }, 2000);
    }, 1500);
}

function handleBozemanBoss(secondsLeft) {
    const s = wagon.finaleState;
    const container = document.getElementById('bozeman-game-container');
    let boss = document.getElementById('bozeman-boss');

    // 1. Spawn Boss if not present
    if (!boss) {
        boss = document.createElement('img');
        boss.id = 'bozeman-boss';
        boss.src = './img/gather/lootbox.png';
        boss.className = 'sanity-glitch';
        boss.style.cssText = `position:absolute; top:-20%; left:40%; width:20cqw; z-index:180; transition: top 2s; filter: hue-rotate(270deg) drop-shadow(0 0 20px red);`;
        container.appendChild(boss);
        
        // Float into position
        setTimeout(() => { boss.style.top = '5%'; }, 100);
        updateActionPrompt(translateSanity("CRITICAL ERROR: CEO_OF_MICROTRANSACTIONS HAS JOINED THE SERVER!"));
        AudioManager.playSound('alert');
    }

    // 2. Fire the "Pay-Wall Laser"
    if (secondsLeft % 2 === 0 && secondsLeft > 0) {
        triggerBossLaser();
    }
}

function triggerBossLaser() {
    const s = wagon.finaleState;
    const container = document.getElementById('bozeman-game-container');
    if (document.getElementById('boss-laser')) return;

    const laser = document.createElement('div');
    laser.id = 'boss-laser';
    // A wide beam centered under the boss
    laser.style.cssText = `position:absolute; top:25%; left:45%; width:10cqw; height:0%; background:rgba(255,0,0,0.6); border:2px solid white; z-index:170; box-shadow: 0 0 30px red;`;
    container.appendChild(laser);

    // Beam growth animation
    setTimeout(() => { laser.style.height = '75%'; }, 50);

    // Collision Check: Laser hits anything in the middle column
    const laserInterval = setInterval(() => {
        const wagonEl = document.getElementById('wagon-player');
        if (!wagonEl || !s.isProcessing) { clearInterval(laserInterval); return; }
        const currentLeft = parseFloat(wagonEl.style.left);
        const currentTop = parseFloat(wagonEl.style.top) || 60;
        
        if (currentLeft > 38 && currentLeft < 57 && currentTop >= 32) {
			s.health = Math.max(0, s.health - (s.laserDrainRate || 0.2)); // Rapid drain, softened by Survival
            s.tookDamage = true; // No Microtransactions requires this to stay false
            document.getElementById('wagon-hp').textContent = Math.ceil(s.health);
            shakeElement('bozeman-game-container');
            if (Math.random() < 0.1) AudioManager.playSound('miss');
            
            if (s.health <= 0) {
                clearInterval(laserInterval);
                s.isProcessing = false;
                finalizeJourney(false);
            }
        }
    }, 100);

    // Clear laser after 1.5 seconds
    setTimeout(() => {
        clearInterval(laserInterval);
        laser.remove();
    }, 1500);
}

function reachSecretLandmark(name) {
    if (name === "Grand Lodge of the Rockies") {
        triggerChoiceEvent({
            title: "The Grand Lodge of the Rockies",
            message: "Hidden behind a waterfall, you find a cave marked with a familiar Square and Compasses. Inside, a group of brothers offers a safe haven.",
            choices: [
                { text: "Seek Light (Wisdom)", action: () => {
                    wagon.sanity = 100; // Complete Sanity restore
                    adjustKarma(15);
                    updateActionPrompt("You spent the night in philosophical discussion. Your mind is perfectly clear.");
                }},
                { text: "Request Charity (Supplies)", action: () => {
                    wagon.food += 200;
                    wagon.axles += 1;
					wagon.wheels += 1;
					wagon.tongues += 1;
                    adjustKarma(5);
                    updateActionPrompt("The Lodge provided for your physical needs. You feel well-provisioned.");
                }},
                { text: "Loot the Altar", action: () => {
                    wagon.money += 200;
                    wagon.sanity = Math.max(0,   wagon.sanity - 40);
                    adjustKarma(-30);
                    updateActionPrompt("You found a 'Legendary Relic' ($200), but the guilt of the 'Anti-Hero' run weighs heavy on your soul. -40 Sanity.");
                }}
            ]
        });
    }
}

function togglePanel(contentId, btn) {
    const content = document.getElementById(contentId);
    if (content) {
        const isCollapsed = content.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? "+" : "−";
        
        // Gamer/Mobile optimization: 
        // Vibrate slightly when toggling if the browser supports it
        if (window.navigator.vibrate) {
            window.navigator.vibrate(10);
        }
    }
}

function showAchievements() {
    const manager = AchievementManager.data;
    const content = document.getElementById("modal-dynamic-content");
    
    // Master list of achievement data
    const list = [
        { id: 'nostalgia', title: 'Party Like Its 1985', desc: 'Embraced your nostalgia (turned Nostalgia mode on)' },
        { id: 'gamer', title: 'Playing with Power', desc: 'Played as the Gamer profession' },
        { id: 'dead', title: 'Unalived', desc: 'Game over because everyone died' },
        { id: 'stranded', title: 'Stranded', desc: 'Game over for lack of oxen' },
        { id: 'insanity', title: 'Sanity is Overrated', desc: 'Game over from insanity' },
        { id: 'river_master', title: 'River Master', desc: 'Completed the Oregon Trail' },
        { id: 'congregation', title: 'Congregation Complete', desc: 'Completed the Mormon Trail' },
        { id: '49er', title: "I'm a 49er", desc: 'Completed the California Trail' },
        { id: 'trader_joe', title: 'Trader Joe', desc: 'Completed the Santa Fe Trail' },
        { id: 'bulletproof', title: 'Bulletproof', desc: 'Completed the Bozeman Trail' },
        { id: 'reverse_card', title: 'Reverse Card!', desc: 'Completed the UNO Reverse trail' },
        { id: 'random_encounter', title: 'Random Encounter', desc: 'Completed the Random trail' },
        { id: 'on_brand', title: 'On Brand', desc: 'Completed the California Trail as a Prospector' },
        { id: 'kraven', title: 'Kraven the Hunter', desc: `Hunted all ${ANIMALS.length} species of animals` },
        { id: 'shiny', title: 'Shiny', desc: 'Caught a legendary Epic Fish' },
        { id: 'full_harvest', title: 'Full Harvest', desc: 'Completed a full gathering session, all four resources, without calling it quits early' },
        { id: 'dry_run', title: 'Dry Run', desc: 'Rafted the rapids without taking a single point of damage' },
        { id: 'frostbite_free', title: 'Frostbite Free', desc: 'Crossed Donner Pass without ever getting hit by a snow block' },
        { id: 'true_believer', title: 'True Believer', desc: 'Crossed to Salt Lake Valley without ever getting hit by the tar and feathers' },
        { id: 'trade_route', title: 'Trade Route', desc: 'Reached Santa Fe with $750 or more in revenue' },
        { id: 'no_microtransactions', title: 'No Microtransactions', desc: 'Beat the Bozeman gauntlet, boss included, without taking a single point of damage' },
        { id: 'minecrafty', title: 'Minecrafty', desc: 'Crafted one of every available item' },
        { id: 'legendary', title: 'Rare Pull', desc: 'Opened a Legendary Lootbox' },
        { id: 'doggo', title: 'Doggo', desc: 'Adopted a faithful doggo' },
        { id: 'casper', title: 'Casper', desc: "Met the Ghost of '47" },
        { id: 'bigfoot', title: 'Less Blurry in Person', desc: 'Met Bigfoot in the woods' },
        { id: 'nft', title: 'NFT', desc: "Obtained Bigfoot's Talisman" },
        { id: 'snuggy', title: 'Snuggy', desc: 'Obtained a warm (if slightly bloody) blanket' },
        { id: 'fahrenheit451', title: 'Fahrenheit 451', desc: 'Burned a book to keep the campfire going' },
        { id: 'gameshark', title: 'Gameshark', desc: 'Utilized a forbidden cheat code' },
        { id: 'open_source', title: 'Open Source', desc: 'Popped open the browser console to peek behind the curtain' },
        { id: 'shortcut_king', title: 'Shortcut King', desc: 'Successfully connected a Trailblaze shortcut' },
        { id: 'eagle_eye', title: 'Eagle Eye', desc: 'Scored a clean read on Scout and earned the forewarned buff' },
        { id: 'good_neighbor', title: 'Good Neighbor', desc: 'A respectful exchange on Diplomacy earned Safe Passage' },
        { id: 'bedside_manner', title: 'Bedside Manner', desc: 'A thorough round on Doctor\'s Rounds caught real problems early' },
        { id: 'grease_monkey', title: 'Grease Monkey', desc: 'A thorough pass on Tune the Wagon caught every loose bolt' },
        { id: 'dead_aim', title: 'Dead Aim', desc: 'A hot streak on Target Practice earned a hunting accuracy buff' },
        { id: 'campfire_raconteur', title: 'Campfire Raconteur', desc: 'Told a tall tale worth telling around the fire' },
        { id: 'full_lives', title: 'Full Lives', desc: 'Completed a trail with 0 deaths' },
        { id: 'guitar_hero', title: 'On a Guitar Controller', desc: 'Completed all 7 trails on Hard difficulty' },
        { id: 'jobby_job', title: 'Jobby Job', desc: 'Completed a trail with all 13 professions' },
        { id: 'speedrunner', title: 'Speedrunner', desc: 'Completed a trail in under 50 days' },
        { id: 'pacifist', title: 'Pacifist', desc: 'Completed a trail without hunting a single animal' },
        { id: 'theseus', title: 'Ship of Theseus', desc: 'Replaced every part of the wagon at least once' },
        { id: 'social_butterfly', title: 'Social Butterfly', desc: 'Mourned at 10 tombstones in a single run' },
        { id: 'emotional_damage', title: 'Emotional Damage', desc: 'Had your bunny eaten 3 times' },
        { id: 'guardian_omen', title: 'Word Gets Around', desc: 'A stranger repaid a debt you didn\'t know you were owed' },
        { id: 'crooked_trail', title: 'What Goes Around', desc: 'The trail finally sent something back your way' },
        { id: 'high_roller', title: 'High Roller', desc: 'Won big at the saloon table' },
        { id: 'caught_cheating', title: 'Caught Red-Handed', desc: 'Got thrown out of a saloon for cheating' },
        { id: 'master_packer', title: 'Master Packer', desc: 'Fit every last piece of cargo in the wagon bed' },
        { id: 'silver_tongue', title: 'Silver Tongue', desc: 'Won three insult duels in a row at one saloon' },
        { id: 'ghost_buster', title: 'Ghost Buster', desc: 'Beat a phantom wagon to the end of the trail' },
        { id: 'nekkid', title: 'Nekkid', desc: 'Completed a Nudist Run without a single stitch of clothing' },
        { id: 'off_the_grid', title: 'Off the Grid', desc: 'Completed a Luddite Run without a single fort purchase' },
        { id: 'snowbird', title: 'Snowbird', desc: 'Completed a Winter Start run' },
        { id: 'phantom_chaser', title: 'Phantom Chaser', desc: 'Completed a Ghost Race' },
        { id: 'garden_variety', title: 'Garden Variety', desc: 'Completed a Vegetarian Run without hunting or fishing' },
        { id: 'creature_of_habit', title: 'Creature of Habit', desc: 'Completed a Daily Challenge run' },
        { id: 'debt_free_scream', title: 'Debt-Free Scream', desc: 'Completed Dave Ramsey Mode on half a bankroll and zero bets' },
        { id: 'no_scummin', title: "No Scummin'", desc: 'Completed a No Save run without reloading around a single bad outcome' },
        { id: 'fast_fingers', title: 'Fast Fingers', desc: 'Sent a near-perfect telegraph home' },
        { id: 'five_finger_discount', title: 'Five Finger Discount', desc: 'Successfully stole from a fort store' },
        { id: 'caught_stealing', title: 'Not Very Sneaky', desc: 'Got caught stealing and thrown out of a fort store' },
        { id: 'eight_seconds', title: '8 Seconds', desc: 'Bought a Mechanical Bull as your draft animal and participated in the worst rodeo of your life' }
    ];

    let html = `<h3>Achievements</h3><div class="achievement-grid">`;

    list.forEach(ach => {
        const isUnlocked = manager.unlocked.includes(ach.id);
        html += `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
                <h4>${isUnlocked ? ach.title : '???'}</h4>
                <p>${isUnlocked ? ach.desc : 'Requirement Hidden'}</p>
            </div>
        `;
    });

    html += `</div><button class="btn btn-danger" style="margin-top:20px;" ${actionAttrs('toggleModal', ['#myModal'])}>Back</button>`;
    
    content.innerHTML = html;
    toggleModal("#myModal");
}

function showDogNamingModal() {
    const content = document.getElementById('modal-dynamic-content');
    if (!content) return;

    // Use classic pixel font sizing conventions
    content.innerHTML = `
        <div style="background: #000; color: #ffd700; padding: 30px; border: 4px double #ffd700; font-family: 'Courier New', monospace; text-align: center;">
            <h2 style="margin-bottom: 15px; letter-spacing: 1px;">🐾 A STRAY APPROACHES 🐾</h2>
            <p style="color: #fff; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.4;">
                A friendly stray dog with a wagging tail starts following your wagon track. He looks healthy and eager to help guard the camp.
            </p>
            
            <label style="display: block; margin-bottom: 12px; font-weight: bold; font-size: 0.9rem; color: #aaa;">
                WHAT WILL YOU NAME YOUR NEW COMPANION?
            </label>
            
            <input type="text" id="dog-name-input" maxlength="12" value="Buster" autofocus
                   style="background: #111; color: #ffd700; border: 2px solid #ffd700; padding: 10px; width: 70%; text-align: center; font-size: 1.3rem; font-weight: bold; text-transform: uppercase;">
            
            <div style="margin-top: 25px;">
                <button class="btn btn-success" style="padding: 8px 30px; font-size: 1.1rem;" ${actionAttrs('finalizeDogAdoption')}>ADOPT</button>
            </div>
        </div>
    `;

    // Ensure modal container anchor is fully rendered
    if (document.getElementById('myModal').style.display !== "block") {
        toggleModal("#myModal");
    }

    // Capture Enter keystrokes safely within the local focus container
    document.getElementById('dog-name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finalizeDogAdoption();
    });
    
    AudioManager.playSound('woof');
}

function finalizeDogAdoption() {
    const input = document.getElementById('dog-name-input');
    let chosenName = input.value.trim();

    // Enforce default fallback constraint if field is blank
    if (!chosenName) {
        chosenName = "Buster";
    }

    // Run the chosen name through the global badWords array to stay clean on the server/graveyard tombstones
    const isOffensive = badWords.some(word => chosenName.toLowerCase().includes(word.toLowerCase()));
    if (isOffensive) {
        chosenName = "Soggy Biscuit";
    }

    // Capitalize properly for the display layouts
    chosenName = chosenName.charAt(0).toUpperCase() + chosenName.slice(1);

    // Commit state changes safely directly to your initialized wagon flag layout schemas
    wagon.flags.has_dog = true;
    wagon.flags.dog_name = chosenName;
    wagon.sanity = Math.min(100, wagon.sanity + 12); // Slightly higher reward for choice completion

    // Grant permanent profile progression unlock record triggers
    AchievementManager.unlock('doggo', 'Doggo');
    AchievementManager.save();

    // Render completion prompt message overlay layout to user
    const content = document.getElementById('modal-dynamic-content');
    content.innerHTML = `
        <div style="background: #000; color: #008800; padding: 30px; border: 4px solid #008800; font-family: 'Courier New', monospace; text-align: center;">
            <h3>🐕 EXCELLENT CHOICE! </h3>
            <p style="color: #fff; margin: 20px 0;">
                <strong>${chosenName.toUpperCase()}</strong> has safely joined the party! Their presence keeps watch over your supplies and boosts family morale.
            </p>
            <button class="btn btn-success" ${actionAttrs('closeModalAndRefreshUI')}>CONTINUE JOURNEY</button>
        </div>
    `;
    
    // Add event log notification string snippet injection 
    eventLog.insertAdjacentHTML('afterbegin', 
        `<span style="color: #ffd700;">Event: ${chosenName} joined your crew.</span><br>`
    );
}