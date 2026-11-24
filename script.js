// =========================================================
// script.js - ระบบเกม 2D งานวัดลอยกระทง (พิม & เป๊ปซี่)
// =========================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 3050;
const WORLD_HEIGHT = 1220;
const RIVER_Y = 810;
const PROMENADE_TOP = 320;

let gameStarted = false;
let audioEnabled = true;
let musicVolume = 0.7;
let audioCtx = null;
let musicInterval = null;
let currentSongIndex = 0;

// =========================================================
// รายการเพลงพื้นหลัง 3 เพลง (ใส่ไฟล์เพลงของคุณไว้ในโฟลเดอร์ sounds/)
// สามารถแก้ไขชื่อเพลง (title) และชื่อไฟล์ (fileSrc: 'sounds/ชื่อไฟล์.mp3') ตรงนี้ได้เลยครับ
// =========================================================
const playlist = [
    {
        id: 0,
        title: 'เพลง 1: ทราย - วัชราวลี',
        subtitle: 'sounds/song1.mp3',
        fileSrc: 'sounds/song1.mp3',
        notes: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25, 587.33],
        tempo: 420
    },
    {
        id: 1,
        title: 'เพลง 2: ดาวหางฮัลเลย์ - fellow fellow',
        subtitle: 'sounds/song2.mp3',
        fileSrc: 'sounds/song2.mp3',
        notes: [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 659.25, 523.25, 440.00, 523.25],
        tempo: 520
    },
    {
        id: 2,
        title: 'เพลง 3: เมื่อถูกค้นพบ - Finally She Found',
        subtitle: 'sounds/song3.mp3',
        fileSrc: 'sounds/song3.mp3',
        notes: [783.99, 880.00, 1046.50, 880.00, 783.99, 659.25, 783.99, 659.25, 587.33, 523.25],
        tempo: 460
    }
];

const bgAudioPlayer = new Audio();
bgAudioPlayer.loop = true;
let usingHtml5Audio = false;

const camera = { x: 650, y: 300 };

// สถานะการนั่งเครื่องเล่นของพิมและเป๊ปซี่
const rideState = {
    active: false,
    type: null, // 'ferris' หรือ 'carousel'
    timer: 0,
    angle: 0
};

// ตัวละครหลัก: พิม (ผู้เล่น) + ช่องเก็บของ 5 ช่อง
const pim = {
    x: 920,
    y: 580,
    targetX: null,
    targetY: null,
    speed: 235,
    walkCycle: 0,
    facing: 1,
    inventory: [null, null, null, null, null],
    selectedSlot: 0,
    get heldItem() {
        return this.inventory[this.selectedSlot] || null;
    },
    set heldItem(val) {
        if (val === null) {
            this.inventory[this.selectedSlot] = null;
        } else {
            this.addToInventory(val);
        }
    },
    addToInventory(item) {
        const emptyIdx = this.inventory.findIndex(slot => slot === null);
        if (emptyIdx !== -1) {
            this.inventory[emptyIdx] = item;
            this.selectedSlot = emptyIdx;
        } else {
            // ถ้าเต็มทั้ง 5 ช่อง ให้แทนที่ช่องที่กำลังเลือกอยู่
            this.inventory[this.selectedSlot] = item;
        }
    },
    chatText: '',
    chatTimer: 0,
    isPraying: false,
    prayTimer: 0
};

// ตัวละครคู่รัก: เป๊ปซี่ (AI เดินตามพิมอัตโนมัติ)
const pepsi = {
    x: 865,
    y: 590,
    speed: 230,
    walkCycle: 0,
    facing: 1,
    chatText: 'คืนนี้พิมน่ารักจังเลย ❤️',
    chatTimer: 5,
    idleTimer: 0,
    isPraying: false,
    prayTimer: 0,
    heartTimer: 0
};

const pepsiSweetPhrases = [
    'เดินดีๆ นะพิม คนเยอะเดี๋ยวหลง ❤️',
    'แวะร้านขายโคมไฟซื้อโคมมาปล่อยคู่กันไหมพิม? 🏮',
    'อยู่ข้างๆ พิมแบบนี้มีความสุขที่สุดเลย 😊',
    'ไปซื้อนก ปลา เต่า มาปล่อยทำบุญด้วยกันไหมพิม? 🕊️🐟',
    'ไปนั่งชิงช้าสวรรค์ชมวิวงานวัดด้วยกันไหม? 🎡',
    'ไปไหว้พระทำบุญด้วยกันนะพิม 🙏✨',
    'ปีนี้และปีต่อๆ ไปก็มาลอยกระทงด้วยกันนะ ❤️'
];

// ร้านค้า กิจกรรม และเครื่องเล่นในงานวันลอยกระทง
const stalls = [
    // โซนด้านบน: ร้านค้าและกิจกรรมงานวัด
    {
        id: 'temple',
        name: 'ซุ้มไหว้พระทำบุญ',
        sub: 'กดเพื่อยกมือไหว้พระทำบุญร่วมกัน',
        icon: '🙏',
        x: 200,
        y: 360,
        interactX: 200,
        interactY: 440,
        radius: 100,
        color: '#f59e0b'
    },
    {
        id: 'animalshop',
        name: 'ร้านขายสัตว์ทำบุญปล่อยชีวิต',
        sub: 'เลือกซื้อนก ปลา หนู เต่า ไปปล่อยทำบุญ',
        icon: '🐟',
        x: 500,
        y: 360,
        interactX: 500,
        interactY: 440,
        radius: 100,
        color: '#10b981'
    },
    {
        id: 'krathong',
        name: 'ร้านขายกระทง',
        sub: 'กระทงใบตอง ดอกไม้ ขนมปัง น้ำแข็ง',
        icon: '🪷',
        x: 800,
        y: 360,
        interactX: 800,
        interactY: 440,
        radius: 95,
        color: '#22c55e'
    },
    {
        id: 'lanternshop',
        name: 'ร้านขายโคมไฟและโคมลอย',
        sub: 'เลือกโคมไฟแล้วปล่อยขึ้นฟ้าจากจุดที่ยืนได้เลย',
        icon: '🏮',
        x: 1100,
        y: 360,
        interactX: 1100,
        interactY: 440,
        radius: 100,
        color: '#fb923c'
    },
    {
        id: 'streetfood',
        name: 'ร้านสตรีทฟู้ดและของกินเล่น',
        sub: 'ลูกชิ้นปิ้ง ไก่ทอด ข้าวโพด หมึกย่าง',
        icon: '🍢',
        x: 1400,
        y: 360,
        interactX: 1400,
        interactY: 440,
        radius: 95,
        color: '#ef4444'
    },
    {
        id: 'dessert',
        name: 'ร้านขนมไทยและเครื่องดื่ม',
        sub: 'บัวลอย ข้าวต้มมัด โตเกียว ชานมไข่มุก',
        icon: '🧋',
        x: 1700,
        y: 360,
        interactX: 1700,
        interactY: 440,
        radius: 95,
        color: '#ec4899'
    },
    {
        id: 'souvenir',
        name: 'ร้านของใช้ ของเล่น และสินค้าทั่วไป',
        sub: 'สินค้าแฮนด์เมด เครื่องประดับ ของเล่น',
        icon: '🧸',
        x: 2000,
        y: 360,
        interactX: 2000,
        interactY: 440,
        radius: 95,
        color: '#f97316'
    },
    {
        id: 'stage',
        name: 'เวทีประกวดนางนพมาศ & มินิคอนเสิร์ต',
        sub: 'กดร่วมสนุกชมการประกวดนางนพมาศคู่กับเป๊ปซี่',
        icon: '🎤',
        x: 2330,
        y: 360,
        interactX: 2330,
        interactY: 445,
        radius: 105,
        color: '#a855f7'
    },
    // โซนเครื่องเล่นงานวัดฝั่งขวา
    {
        id: 'ferris',
        name: 'ชิงช้าสวรรค์',
        sub: 'กดขึ้นนั่งชิงช้าสวรรค์ชมวิวกับเป๊ปซี่',
        icon: '🎡',
        x: 2640,
        y: 450,
        interactX: 2640,
        interactY: 510,
        radius: 115,
        color: '#38bdf8'
    },
    {
        id: 'carousel',
        name: 'ม้าหมุนงานวัด',
        sub: 'กดขึ้นขี่ม้าหมุนสุดโรแมนติก',
        icon: '🎠',
        x: 2880,
        y: 560,
        interactX: 2880,
        interactY: 615,
        radius: 105,
        color: '#fb7185'
    },
    {
        id: 'balloon',
        name: 'ซุ้มปาโป่งงานวัด',
        sub: 'กดเล่นปาโป่งชิงรางวัลให้พิม',
        icon: '🎯',
        x: 2610,
        y: 660,
        interactX: 2610,
        interactY: 700,
        radius: 95,
        color: '#8b5cf6'
    },
    // โซนริมแม่น้ำด้านล่าง
    {
        id: 'trashbin',
        name: 'จุดทิ้งขยะ 4 สี (เขียว เหลือง น้ำเงิน แดง)',
        sub: 'กดเพื่อทิ้งของในกระเป๋าแยกตามประเภท',
        icon: '🗑️',
        x: 560,
        y: 810,
        interactX: 560,
        interactY: 775,
        radius: 105,
        color: '#10b981'
    },
    {
        id: 'pier',
        name: 'ท่าน้ำลอยกระทง',
        sub: 'ขอขมาพระแม่คงคาและลอยกระทงคู่กัน',
        icon: '🌊',
        x: 1120,
        y: 825,
        interactX: 1120,
        interactY: 790,
        radius: 135,
        color: '#38bdf8'
    },
    {
        id: 'releasespot',
        name: 'จุดปล่อยปลาและปล่อยสัตว์ทำบุญ',
        sub: 'นำสัตว์ที่ซื้อจากร้านมาปล่อยทำบุญตรงนี้',
        icon: '🐟',
        x: 1650,
        y: 805,
        interactX: 1650,
        interactY: 775,
        radius: 115,
        color: '#34d399'
    }
];

const floatingKrathongs = [];
const skyLanterns = [];
const fireworks = [];
const floatingHearts = [];
const riverRipples = [];
const riverFish = [];
const releasedAnimals = [];
const savedMemories = [];

const stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * 240,
    size: Math.random() * 2.2 + 0.5,
    twinkle: Math.random() * Math.PI * 2
}));

for (let i = 0; i < 16; i++) {
    riverFish.push({
        x: Math.random() * WORLD_WIDTH,
        y: RIVER_Y + 35 + Math.random() * 180,
        vx: (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 22),
        size: 5 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2
    });
}

for (let i = 0; i < 12; i++) {
    floatingKrathongs.push({
        x: 150 + i * 240 + Math.random() * 60,
        y: RIVER_Y + 45 + (i % 3) * 58,
        vx: 11 + Math.random() * 7,
        type: ['banana', 'lotus', 'bread', 'ice'][i % 4],
        deco: ['lotus', 'marigold', 'rose'][i % 3],
        owner: '',
        wish: '',
        bobOffset: Math.random() * Math.PI * 2,
        isSpecial: false
    });
}

// =========================================================
// ระบบร้านขายโคมไฟ & ปล่อยโคมลอยตรงจุดที่ยืนอยู่ได้เลย
// =========================================================
function pickLanternItem(name, bodyColor, glowColor, icon) {
    closeAllModals();
    playSuccessChime();
    pim.heldItem = {
        kind: 'lantern',
        name,
        bodyColor,
        glowColor,
        icon
    };
    updateHeldItemUI();
    pim.chatText = `ได้${name}แล้ว! ปล่อยตรงจุดที่ยืนได้เลย 🏮✨`;
    pim.chatTimer = 4.5;
    pepsi.chatText = `โคมสวยมากพิม กดปุ่ม "ปล่อยโคมลอยตรงนี้เลย" เมื่อไหร่ก็ได้ครับ ❤️`;
    pepsi.chatTimer = 5.5;
    showToast(`รับ${name}มาแล้ว! กดปุ่มสีส้มขวาล่างเพื่อปล่อยโคมจากตรงที่ยืนได้เลย`, icon);
}

function releaseSkyLantern() {
    if (!pim.heldItem || pim.heldItem.kind !== 'lantern') return;
    const lanternItem = pim.heldItem;
    playSuccessChime();
    pim.heldItem = null;
    updateHeldItemUI();

    // ปล่อยโคมลอยขึ้นสู่ท้องฟ้าจากตำแหน่งตรงที่พิมและเป๊ปซี่ยืนอยู่พอดี
    const launchX = (pim.x + pepsi.x) / 2;
    const launchY = Math.min(pim.y, pepsi.y) - 48;

    skyLanterns.push({
        x: launchX,
        y: launchY,
        vy: -42 - Math.random() * 10,
        sway: Math.random() * Math.PI * 2,
        scale: 1.25,
        bodyColor: lanternItem.bodyColor || '#fb923c',
        glowColor: lanternItem.glowColor || '#fef08a',
        label: 'พิม ❤️ เป๊ปซี่'
    });

    pim.chatText = `ปล่อย${lanternItem.name}ขึ้นฟ้าแล้ว สวยจัง! ✨`;
    pim.chatTimer = 4.5;
    pepsi.chatText = 'โคมลอยขึ้นฟ้าจากตรงที่เรายืนสวยมากๆ ขอให้รักของเราสว่างไสวแบบนี้ตลอดไปนะพิม ❤️';
    pepsi.chatTimer = 5.5;

    savedMemories.unshift({
        krathongName: `ปล่อย${lanternItem.name}`,
        pimWish: `ปล่อย${lanternItem.name}ขึ้นสู่ท้องฟ้าคู่กับเป๊ปซี่`,
        pepsiWish: 'ขอให้ความรักของเราสว่างไสวสวยงามเหมือนแสงโคมคืนวันเพ็ญครับ ❤️',
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    });
    updateMemoriesUI();

    showToast(`ปล่อย${lanternItem.name}ขึ้นฟ้าจากตรงที่ยืนเรียบร้อย!`, lanternItem.icon);
    for (let i = 0; i < 10; i++) {
        spawnHeart(launchX + (Math.random() * 60 - 30), launchY, '#fbbf24');
    }
}

// =========================================================
// ระบบซื้อสัตว์ทำบุญปล่อยชีวิต (นก ปลา หนู เต่า หอย กบ)
// =========================================================
function selectReleaseAnimal(animalType, name, icon, blessingQuote) {
    closeAllModals();
    playSuccessChime();
    pim.heldItem = {
        kind: 'animal',
        animalType,
        name,
        icon,
        blessingQuote
    };
    updateHeldItemUI();
    pim.chatText = `รับ${name}มาแล้ว เดินไปจุดปล่อยสัตว์ริมน้ำกันเถอะ ${icon}`;
    pim.chatTimer = 4.5;
    pepsi.chatText = `อนุโมทนาสาธุครับพิม เดินไปที่ "จุดปล่อยปลาและปล่อยสัตว์ทำบุญ" ริมน้ำกัน ❤️`;
    pepsi.chatTimer = 5.5;
    showToast(`รับ${name}แล้ว! เดินไปที่จุดปล่อยปลาและปล่อยสัตว์ทำบุญริมน้ำ`, icon);
}

function releaseBoughtAnimal() {
    if (!pim.heldItem || pim.heldItem.kind !== 'animal') return;
    const item = pim.heldItem;
    pim.heldItem = null;
    updateHeldItemUI();

    playSuccessChime();
    pim.isPraying = true;
    pim.prayTimer = 2.5;
    pepsi.isPraying = true;
    pepsi.prayTimer = 2.5;

    pim.chatText = `${item.blessingQuote} 🙏✨`;
    pim.chatTimer = 4;
    pepsi.chatText = `ขอให้ผลบุญจากการปล่อย${item.name} ส่งผลให้พิมมีความสุขมากๆ นะ ❤️`;
    pepsi.chatTimer = 4.5;

    if (item.animalType === 'bird') {
        for (let i = 0; i < 3; i++) {
            releasedAnimals.push({
                kind: 'bird',
                icon: '🕊️',
                x: 1640 + i * 16,
                y: 760,
                vx: 45 + i * 12,
                vy: -55 - i * 8,
                alpha: 1,
                timer: 5
            });
        }
    } else if (item.animalType === 'mouse') {
        for (let i = 0; i < 2; i++) {
            releasedAnimals.push({
                kind: 'land',
                icon: '🐭',
                x: 1640 + i * 18,
                y: 770,
                vx: 55 + i * 15,
                vy: 0,
                alpha: 1,
                timer: 4.5
            });
        }
    } else {
        for (let i = 0; i < 4; i++) {
            riverRipples.push({
                x: 1630 + i * 15,
                y: RIVER_Y + 25 + i * 8,
                r: 5,
                alpha: 1
            });
            releasedAnimals.push({
                kind: 'water',
                icon: item.icon,
                x: 1635 + i * 14,
                y: RIVER_Y + 25 + i * 10,
                vx: (i % 2 === 0 ? 1 : -1) * (35 + i * 8),
                vy: 14,
                alpha: 1,
                timer: 5.5
            });
        }
    }

    for (let i = 0; i < 8; i++) {
        spawnHeart((pim.x + pepsi.x) / 2, pim.y - 50, '#34d399');
    }

    savedMemories.unshift({
        krathongName: `ทำบุญปล่อย${item.name}`,
        pimWish: item.blessingQuote,
        pepsiWish: `ทำบุญปล่อย${item.name}ร่วมกับพิม ขอให้เราสองคนมีแต่ความสุขความเจริญครับ ❤️`,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    });
    updateMemoriesUI();

    showToast(`พิมและเป๊ปซี่ยกมือไหว้และปล่อย${item.name}คืนสู่ธรรมชาติเรียบร้อย 🙏${item.icon}`, item.icon);
}

// =========================================================
// ปุ่มยกมือไหว้คู่กัน (ทั้งพิมและเป๊ปซี่)
// =========================================================
function triggerCoupleWai() {
    if (!gameStarted || isAnyModalOpen()) return;
    playSuccessChime();

    pim.isPraying = true;
    pim.prayTimer = 2.8;
    pepsi.isPraying = true;
    pepsi.prayTimer = 2.8;

    pim.targetX = null;
    pim.targetY = null;

    if (activeInteractTarget && activeInteractTarget.id === 'temple') {
        pim.chatText = 'สาธุ... ขอพรพระร่วมกับเป๊ปซี่ 🙏✨';
        pepsi.chatText = 'สาธุครับ ขอให้พิมมีแต่ความสุข สุขภาพแข็งแรงนะ 🙏❤️';
        showToast('พิมและเป๊ปซี่ยกมือไหว้พระทำบุญร่วมกัน 🙏✨', '🙏');
    } else if (activeInteractTarget && activeInteractTarget.id === 'pier') {
        pim.chatText = 'ขอขมาพระแม่คงคาเจ้าค่ะ 🙏🌊';
        pepsi.chatText = 'ขอขมาพระแม่คงคา และขอให้เราอยู่ด้วยกันนานๆ ครับ 🙏❤️';
        showToast('พิมและเป๊ปซี่ยกมือไหว้ขอขมาพระแม่คงคาริมท่าน้ำ 🙏🌊', '🙏');
    } else if (activeInteractTarget && activeInteractTarget.id === 'releasespot') {
        pim.chatText = 'ตั้งจิตอธิษฐานทำบุญปล่อยสัตว์ 🙏🐟';
        pepsi.chatText = 'อนุโมทนาสาธุร่วมกันครับพิม 🙏❤️';
        showToast('พิมและเป๊ปซี่ยกมือไหว้อธิษฐานทำบุญริมน้ำ 🙏✨', '🙏');
    } else {
        pim.chatText = 'สวัสดีค่า ไหว้สวยๆ คู่กับเป๊ปซี่ 🙏💕';
        pepsi.chatText = 'ไหว้พร้อมพิมครับ น่ารักที่สุดเลย 🙏❤️';
        showToast('พิมและเป๊ปซี่ยกมือไหว้คู่กันอย่างน่ารัก 🙏❤️', '🙏');
    }

    pim.chatTimer = 3.2;
    pepsi.chatTimer = 3.2;

    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            spawnHeart((pim.x + pepsi.x) / 2 + (Math.random() * 60 - 30), pim.y - 55, i % 2 === 0 ? '#fde047' : '#fb7185');
        }, i * 110);
    }
}

// =========================================================
// ระบบบังคับตัวละคร (จอยสติ๊ก / แตะพื้น / คีย์บอร์ด)
// =========================================================
const joystick = { active: false, dx: 0, dy: 0, originX: 0, originY: 0, maxRadius: 42 };
const keys = {};
let activeInteractTarget = null;

window.addEventListener('keydown', (e) => {
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
        selectInventorySlot(parseInt(e.key, 10) - 1);
    }
    keys[e.key.toLowerCase()] = true;
    pim.targetX = null;
    pim.targetY = null;
    if (e.key === ' ' || e.key === 'Enter') {
        if (activeInteractTarget && !isAnyModalOpen()) handleInteract();
    }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const joystickZone = document.getElementById('joystickZone');
const joystickKnob = document.getElementById('joystickKnob');

joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (rideState.active) return;
    const touch = e.changedTouches[0];
    const rect = joystickZone.getBoundingClientRect();
    joystick.active = true;
    joystick.originX = rect.left + rect.width / 2;
    joystick.originY = rect.top + rect.height / 2;
    pim.targetX = null;
    pim.targetY = null;
    updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystick.active) return;
    const touch = e.changedTouches[0];
    updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

const endJoystick = () => {
    joystick.active = false;
    joystick.dx = 0;
    joystick.dy = 0;
    joystickKnob.style.transform = `translate(0px, 0px)`;
};
joystickZone.addEventListener('touchend', endJoystick);
joystickZone.addEventListener('touchcancel', endJoystick);

function updateJoystick(clientX, clientY) {
    let diffX = clientX - joystick.originX;
    let diffY = clientY - joystick.originY;
    const dist = Math.hypot(diffX, diffY);
    if (dist > joystick.maxRadius) {
        diffX = (diffX / dist) * joystick.maxRadius;
        diffY = (diffY / dist) * joystick.maxRadius;
    }
    joystickKnob.style.transform = `translate(${diffX}px, ${diffY}px)`;
    joystick.dx = diffX / joystick.maxRadius;
    joystick.dy = diffY / joystick.maxRadius;
}

canvas.addEventListener('pointerdown', (e) => {
    if (!gameStarted || isAnyModalOpen() || rideState.active) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left) + camera.x;
    const worldY = (e.clientY - rect.top) + camera.y;
    pim.targetX = Math.max(80, Math.min(WORLD_WIDTH - 80, worldX));
    pim.targetY = Math.max(PROMENADE_TOP + 60, Math.min(RIVER_Y - 12, worldY));
    spawnHeart(pim.targetX, pim.targetY, '#fde047');
});

// =========================================================
// ระบบเสียงเพลงพื้นหลัง 4 เพลง (รองรับไฟล์เพลงของเรา + ปรับระดับเสียง)
// =========================================================
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playSelectedSong(currentSongIndex, false);
}

function startSynthFallbackLoop(song) {
    usingHtml5Audio = false;
    if (musicInterval) clearInterval(musicInterval);
    let step = 0;
    musicInterval = setInterval(() => {
        if (!audioEnabled || !gameStarted || usingHtml5Audio || musicVolume <= 0) return;
        const notes = song.notes;
        playRanatNote(notes[step % notes.length], 0.2, 0.055 * musicVolume);
        if (step % 4 === 0) playRanatNote(notes[(step + 2) % notes.length] / 2, 0.35, 0.045 * musicVolume);
        step++;
    }, song.tempo || 420);
}

function playSelectedSong(index, announce = true) {
    currentSongIndex = index;
    const song = playlist[index];
    if (!song) return;

    const hudNameEl = document.getElementById('currentSongHudName');
    if (hudNameEl) hudNameEl.textContent = `เพลงที่ ${index + 1}`;

    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }

    bgAudioPlayer.pause();
    bgAudioPlayer.src = song.fileSrc;
    bgAudioPlayer.volume = audioEnabled ? musicVolume : 0;

    const playPromise = bgAudioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            usingHtml5Audio = true;
            renderMusicModalUI();
        }).catch(() => {
            // หากยังไม่ได้ใส่ไฟล์ใน sounds/ จะเล่นทำนองดนตรีในตัวอัตโนมัติแทน
            startSynthFallbackLoop(song);
            renderMusicModalUI();
        });
    } else {
        startSynthFallbackLoop(song);
        renderMusicModalUI();
    }

    if (announce) {
        showToast(`เปลี่ยนเป็น "${song.title}" แล้ว`, '🎶');
    }
}

function setMusicVolume(val) {
    musicVolume = Math.max(0, Math.min(1, val));
    if (musicVolume > 0 && !audioEnabled) {
        audioEnabled = true;
    }
    bgAudioPlayer.volume = audioEnabled ? musicVolume : 0;
    renderMusicModalUI();
}

function stepVolume(delta) {
    const nextVol = Math.round((musicVolume + delta) * 10) / 10;
    setMusicVolume(nextVol);
    const slider = document.getElementById('volumeSlider');
    if (slider) slider.value = Math.round(musicVolume * 100);
}

function playRanatNote(freq, duration, volume = 0.05) {
    if (!audioCtx || !audioEnabled || musicVolume <= 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    const effectiveVol = Math.max(0.0005, volume * (usingHtml5Audio ? musicVolume : 1));
    gain.gain.setValueAtTime(effectiveVol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSuccessChime() {
    if (!audioCtx || !audioEnabled) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
        setTimeout(() => playRanatNote(f, 0.35, 0.06), idx * 90);
    });
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    bgAudioPlayer.volume = audioEnabled ? musicVolume : 0;
    if (audioEnabled && usingHtml5Audio && bgAudioPlayer.paused) {
        bgAudioPlayer.play().catch(() => {});
    }
    renderMusicModalUI();
    showToast(audioEnabled ? 'เปิดเสียงเพลงแล้ว' : 'ปิดเสียงเพลงชั่วคราว', audioEnabled ? '🔊' : '🔇');
}

function openMusicModal() {
    renderMusicModalUI();
    openModal('modalMusicPlayer');
}

function renderMusicModalUI() {
    const pct = Math.round(musicVolume * 100);
    const pctText = document.getElementById('volumePercentText');
    const slider = document.getElementById('volumeSlider');
    const audioIcon = document.getElementById('audioIcon');
    const modalIcon = document.getElementById('modalAudioStatusIcon');
    const muteBtn = document.getElementById('btnToggleMute');

    if (pctText) pctText.textContent = audioEnabled ? `${pct}%` : 'ปิดเสียง (0%)';
    if (slider) slider.value = audioEnabled ? pct : 0;
    if (audioIcon) audioIcon.textContent = (!audioEnabled || pct === 0) ? '🔇' : '🎶';
    if (modalIcon) modalIcon.textContent = (!audioEnabled || pct === 0) ? '🔇' : (pct < 45 ? '🔉' : '🔊');
    if (muteBtn) muteBtn.textContent = audioEnabled ? 'ปิดเสียงชั่วคราว' : 'เปิดเสียงเพลง';

    const listContainer = document.getElementById('songListContainer');
    if (!listContainer) return;

    listContainer.innerHTML = playlist.map((song, idx) => {
        const isCurrent = idx === currentSongIndex;
        const activeStyle = isCurrent
            ? 'border-amber-300 bg-amber-400/20 shadow-md'
            : 'border-white/15 bg-white/5 hover:bg-white/10';

        return `
            <button onclick="playSelectedSong(${idx}, true)" class="w-full rounded-2xl p-3 border ${activeStyle} flex items-center justify-between gap-3 text-left transition active:scale-98">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-9 h-9 rounded-xl ${isCurrent ? 'bg-amber-400 text-indigo-950 shadow' : 'bg-white/10 text-amber-200'} flex items-center justify-center font-bold text-sm shrink-0">
                        ${isCurrent ? '▶' : idx + 1}
                    </span>
                    <div class="min-w-0">
                        <div class="text-sm font-semibold ${isCurrent ? 'text-amber-200' : 'text-white'} truncate">${song.title}</div>
                        <div class="text-[11px] text-white/65 truncate">${song.subtitle}</div>
                    </div>
                </div>
                <span class="text-xs font-semibold ${isCurrent ? 'text-amber-300' : 'text-white/40'} shrink-0">
                    ${isCurrent ? 'กำลังเล่น 🎶' : 'กดเลือก'}
                </span>
            </button>
        `;
    }).join('');
}

// =========================================================
// ระบบแต่งกระทงและพรีวิวกระทงละเอียด
// =========================================================
const krathongDraft = {
    base: 'banana',
    baseName: 'กระทงใบตอง',
    icon: '🪷',
    deco: 'lotus',
    decoName: 'ดอกบัวชมพู'
};

function setKrathongBase(base, baseName, icon) {
    krathongDraft.base = base;
    krathongDraft.baseName = baseName;
    krathongDraft.icon = icon;
    ['banana', 'lotus', 'bread', 'ice'].forEach(b => {
        const el = document.getElementById('base-' + b);
        if (b === base) el.classList.add('border-amber-300', 'bg-amber-400/20');
        else el.classList.remove('border-amber-300', 'bg-amber-400/20');
    });
    renderKrathongPreview();
}

function setKrathongDeco(deco, decoName) {
    krathongDraft.deco = deco;
    krathongDraft.decoName = decoName;
    ['lotus', 'marigold', 'rose'].forEach(d => {
        const el = document.getElementById('deco-' + d);
        if (d === deco) el.classList.add('border-amber-300', 'bg-amber-400/20');
        else el.classList.remove('border-amber-300', 'bg-amber-400/20');
    });
    renderKrathongPreview();
}

function renderKrathongPreview() {
    const pCanvas = document.getElementById('krathongPreviewCanvas');
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    pCtx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    pCtx.beginPath();
    pCtx.ellipse(80, 78, 65, 16, 0, 0, Math.PI * 2);
    pCtx.fill();

    drawDetailedKrathongShape(pCtx, 80, 70, krathongDraft.base, krathongDraft.deco, 1.5, performance.now());
    document.getElementById('previewKrathongLabel').textContent = `${krathongDraft.baseName} + ${krathongDraft.decoName}`;
}

function confirmSelectKrathong() {
    playSuccessChime();
    const fullName = `${krathongDraft.baseName} (${krathongDraft.decoName})`;
    pim.heldItem = {
        kind: 'krathong',
        type: krathongDraft.base,
        deco: krathongDraft.deco,
        name: fullName,
        icon: krathongDraft.icon
    };
    updateHeldItemUI();
    closeAllModals();
    pim.chatText = `ได้${krathongDraft.baseName}แล้ว! ไปท่าน้ำกันเถอะ 🪷`;
    pim.chatTimer = 4;
    pepsi.chatText = 'กระทงวัสดุธรรมชาติสวยมากพิม เดินไปที่ท่าน้ำกันครับ ❤️';
    pepsi.chatTimer = 5;
    showToast(`เลือก${krathongDraft.baseName}แล้ว! เดินไปที่ท่าน้ำเพื่ออธิษฐาน`, krathongDraft.icon);
}

function drawDetailedKrathongShape(targetCtx, x, y, baseType, decoType, scale, time) {
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.scale(scale, scale);

    const flicker = 1 + Math.sin(time * 0.015) * 0.08;
    const glow = targetCtx.createRadialGradient(0, -16, 2, 0, -16, 34 * flicker);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.35)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    targetCtx.fillStyle = glow;
    targetCtx.beginPath();
    targetCtx.arc(0, -16, 34 * flicker, 0, Math.PI * 2);
    targetCtx.fill();

    if (baseType === 'banana') {
        targetCtx.fillStyle = '#15803d';
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
        targetCtx.fill();
        for (let i = -3; i <= 3; i++) {
            const px = i * 6;
            targetCtx.fillStyle = i % 2 === 0 ? '#22c55e' : '#4ade80';
            targetCtx.beginPath();
            targetCtx.moveTo(px - 4, 0);
            targetCtx.lineTo(px, -11);
            targetCtx.lineTo(px + 4, 0);
            targetCtx.closePath();
            targetCtx.fill();
        }
    } else if (baseType === 'lotus') {
        for (let i = -3; i <= 3; i++) {
            const px = i * 6.5;
            targetCtx.fillStyle = '#f472b6';
            targetCtx.beginPath();
            targetCtx.ellipse(px, -3, 5, 9, i * 0.18, 0, Math.PI * 2);
            targetCtx.fill();
        }
        for (let i = -2; i <= 2; i++) {
            const px = i * 6;
            targetCtx.fillStyle = '#fbcfe8';
            targetCtx.beginPath();
            targetCtx.ellipse(px, -5, 4.5, 8, i * 0.12, 0, Math.PI * 2);
            targetCtx.fill();
        }
    } else if (baseType === 'bread') {
        targetCtx.fillStyle = '#d97706';
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, 21, 8, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = '#fb7185';
        targetCtx.beginPath();
        targetCtx.arc(-6, -5, 6, 0, Math.PI * 2);
        targetCtx.arc(6, -5, 6, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.beginPath();
        targetCtx.moveTo(-12, -4);
        targetCtx.lineTo(12, -4);
        targetCtx.lineTo(0, 5);
        targetCtx.closePath();
        targetCtx.fill();
    } else if (baseType === 'ice') {
        targetCtx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        targetCtx.strokeStyle = '#e0f2fe';
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        for (let i = -2; i <= 2; i++) {
            targetCtx.fillStyle = 'rgba(224, 242, 254, 0.75)';
            targetCtx.beginPath();
            targetCtx.moveTo(i * 7 - 4, 0);
            targetCtx.lineTo(i * 7, -10);
            targetCtx.lineTo(i * 7 + 4, 0);
            targetCtx.closePath();
            targetCtx.fill();
        }
    }

    const flowerColor = decoType === 'marigold' ? '#facc15' : (decoType === 'rose' ? '#e11d48' : '#f472b6');
    [-11, -5, 5, 11].forEach(fx => {
        targetCtx.fillStyle = flowerColor;
        targetCtx.beginPath();
        targetCtx.arc(fx, -4, 3.2, 0, Math.PI * 2);
        targetCtx.fill();
    });

    targetCtx.strokeStyle = '#a16207';
    targetCtx.lineWidth = 1.2;
    [-4, 0, 4].forEach(ix => {
        targetCtx.beginPath();
        targetCtx.moveTo(ix * 0.5, -4);
        targetCtx.lineTo(ix, -20);
        targetCtx.stroke();
        targetCtx.fillStyle = '#ef4444';
        targetCtx.beginPath();
        targetCtx.arc(ix, -20.5, 1.2, 0, Math.PI * 2);
        targetCtx.fill();
    });

    targetCtx.fillStyle = '#fef08a';
    targetCtx.fillRect(-2, -16, 4, 12);
    const flameSway = Math.sin(time * 0.02) * 1.2;
    targetCtx.fillStyle = '#f97316';
    targetCtx.beginPath();
    targetCtx.ellipse(flameSway, -19, 2.5, 4.5, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.arc(flameSway, -18, 1.3, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.restore();
}

// =========================================================
// การโต้ตอบกับร้านค้า กิจกรรม และเครื่องเล่นต่างๆ
// =========================================================
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('topHud').classList.remove('hidden');
    document.getElementById('touchControls').classList.remove('hidden');
    document.getElementById('inventoryWrapper').classList.remove('hidden');
    updateHeldItemUI();
    gameStarted = true;
    initAudio();
    playSuccessChime();
    showToast('ยินดีต้อนรับพิม! เป๊ปซี่เดินตามอยู่นะ ❤️', '🪷');
}

function selectInventorySlot(index) {
    if (index < 0 || index >= 5) return;
    pim.selectedSlot = index;
    playRanatNote(659.25, 0.1, 0.04);
    updateHeldItemUI();
    const item = pim.heldItem;
    if (item) {
        showToast(`เลือกช่องที่ ${index + 1}: ${item.name}`, item.icon);
    }
}

function updateHeldItemUI() {
    const el = document.getElementById('heldItemDisplay');
    const btnLantern = document.getElementById('btnReleaseLantern');

    // อัปเดตหน้าตาช่องเก็บของ 5 ช่องตรงกลางล่าง
    for (let i = 0; i < 5; i++) {
        const slotEl = document.getElementById('invSlot' + i);
        if (!slotEl) continue;
        const item = pim.inventory[i];
        if (i === pim.selectedSlot) {
            slotEl.classList.add('inv-slot-active');
        } else {
            slotEl.classList.remove('inv-slot-active');
        }

        if (item) {
            slotEl.innerHTML = `
                <span class="text-xl sm:text-2xl leading-none">${item.icon}</span>
                <span class="text-[8px] sm:text-[9px] text-amber-100/90 truncate max-w-[42px] mt-0.5 leading-none">${item.name}</span>
                <span class="absolute top-0.5 left-1 text-[8px] text-amber-300/70 font-bold">${i + 1}</span>
            `;
        } else {
            slotEl.innerHTML = `
                <span class="absolute top-0.5 left-1 text-[8px] text-white/30 font-bold">${i + 1}</span>
            `;
        }
    }

    if (!pim.heldItem) {
        el.innerHTML = `<span>ช่อง ${pim.selectedSlot + 1}: มือว่าง</span>`;
        btnLantern.classList.add('hidden');
    } else if (pim.heldItem.kind === 'krathong') {
        el.innerHTML = `<span>${pim.heldItem.icon} ถือ${pim.heldItem.name}</span>`;
        btnLantern.classList.add('hidden');
    } else if (pim.heldItem.kind === 'lantern') {
        el.innerHTML = `<span>${pim.heldItem.icon} ถือ${pim.heldItem.name}</span>`;
        btnLantern.classList.remove('hidden');
    } else if (pim.heldItem.kind === 'animal') {
        el.innerHTML = `<span>${pim.heldItem.icon} เตรียมปล่อย${pim.heldItem.name}</span>`;
        btnLantern.classList.add('hidden');
    } else {
        el.innerHTML = `<span>${pim.heldItem.icon} ถือ${pim.heldItem.name}</span>`;
        btnLantern.classList.add('hidden');
    }
}

function pickFoodItem(name, icon, pimQuote) {
    closeAllModals();
    playSuccessChime();
    pim.heldItem = { kind: 'food', name, icon };
    updateHeldItemUI();
    pim.chatText = pimQuote;
    pim.chatTimer = 4;
    pepsi.chatText = 'อร่อยไหมพิม เดี๋ยวเป๊ปซี่จ่ายให้เอง กินเยอะๆ นะ ❤️';
    pepsi.chatTimer = 5;
    for (let i = 0; i < 6; i++) spawnHeart((pim.x + pepsi.x) / 2, pim.y - 45, '#fb7185');
    showToast(`ซื้อ${name}มากินเดินเที่ยวงานกับเป๊ปซี่!`, icon);
}

function pickSouvenirItem(name, icon) {
    closeAllModals();
    playSuccessChime();
    pim.heldItem = { kind: 'souvenir', name, icon };
    updateHeldItemUI();
    pim.chatText = `น่ารักจังเลย ได้${name}แล้ว! ${icon}`;
    pim.chatTimer = 4;
    pepsi.chatText = 'เหมาะกับพิมมากๆ เลยครับ เป๊ปซี่ซื้อให้เป็นที่ระลึกนะ ❤️';
    pepsi.chatTimer = 5;
    for (let i = 0; i < 6; i++) spawnHeart((pim.x + pepsi.x) / 2, pim.y - 45, '#f472b6');
    showToast(`เป๊ปซี่ซื้อ${name}ให้พิม!`, icon);
}

function handleInteract() {
    if (!activeInteractTarget || rideState.active) return;
    const id = activeInteractTarget.id;

    if (id === 'temple') {
        triggerCoupleWai();
    } else if (id === 'lanternshop') {
        openModal('modalLanternShop');
    } else if (id === 'animalshop') {
        openModal('modalAnimalShop');
    } else if (id === 'krathong') {
        openModal('modalKrathongShop');
        renderKrathongPreview();
    } else if (id === 'streetfood') {
        openModal('modalStreetFood');
    } else if (id === 'dessert') {
        openModal('modalThaiDessert');
    } else if (id === 'souvenir') {
        openModal('modalSouvenirShop');
    } else if (id === 'stage') {
        playSuccessChime();
        pim.chatText = 'นางนพมาศสวยมาก ดนตรีก็สนุกจังเลยเป๊ปซี่! 🎤✨';
        pim.chatTimer = 4.5;
        pepsi.chatText = 'สำหรับเป๊ปซี่ พิมคือนางนพมาศที่สวยที่สุดในงานเลยครับ ❤️';
        pepsi.chatTimer = 5;
        triggerCelebrationFireworks();
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                spawnHeart((pim.x + pepsi.x) / 2 + (Math.random() * 50 - 25), pim.y - 50, '#f472b6');
            }, i * 110);
        }
        showToast('พิมและเป๊ปซี่ร่วมชมการประกวดนางนพมาศและมินิคอนเสิร์ตหน้าเวที 🎤❤️', '🎤');
    } else if (id === 'ferris') {
        startRide('ferris');
    } else if (id === 'carousel') {
        startRide('carousel');
    } else if (id === 'balloon') {
        startBalloonMinigame();
    } else if (id === 'trashbin') {
        openTrashBinModal();
    } else if (id === 'releasespot') {
        if (pim.heldItem && pim.heldItem.kind === 'animal') {
            releaseBoughtAnimal();
        } else {
            pepsi.chatText = 'เรายังไม่ได้ซื้อปลากับสัตว์ที่ร้านเลยพิม ไปเลือกที่ "ร้านขายสัตว์ทำบุญปล่อยชีวิต" ก่อนนะ 🕊️🐟';
            pepsi.chatTimer = 5.5;
            showToast('แวะเลือกซื้อนก ปลา หนู หรือเต่าที่ร้านขายสัตว์ทำบุญก่อนนะ!', '🕊️');
        }
    } else if (id === 'pier') {
        if (pim.heldItem && pim.heldItem.kind === 'krathong') {
            document.getElementById('wishKrathongName').textContent = pim.heldItem.name;
            document.getElementById('wishInput').value = '';
            openModal('modalWish');
        } else {
            pepsi.chatText = 'เรายังไม่มีกระทงเลยพิม ไปเลือกที่ร้านขายกระทงก่อนไหม? 🪷';
            pepsi.chatTimer = 5;
            showToast('แวะเลือกกระทงวัสดุธรรมชาติที่ร้านขายกระทงก่อนนะ!', '🪷');
        }
    }
}

// =========================================================
// ระบบนั่งชิงช้าสวรรค์และม้าหมุน
// =========================================================
function startRide(type) {
    playSuccessChime();
    rideState.active = true;
    rideState.type = type;
    rideState.timer = 6.5;
    pim.targetX = null;
    pim.targetY = null;

    if (type === 'ferris') {
        pim.chatText = 'ว้าว! วิวงานลอยกระทงจากข้างบนสวยมากเลยเป๊ปซี่ 🎡✨';
        pepsi.chatText = 'นั่งชิงช้าสวรรค์กับพิมโรแมนติกที่สุดเลย ❤️';
        showToast('ขึ้นนั่งชิงช้าสวรรค์ชมวิวงานวัดคืนวันเพ็ญกับเป๊ปซี่ 🎡', '🎡');
    } else {
        pim.chatText = 'ขี่ม้าหมุนสนุกจังเลย 🎠💕';
        pepsi.chatText = 'เป๊ปซี่ขี่ม้าอยู่ข้างๆ พิมตลอดเลยครับ ❤️';
        showToast('ขึ้นขี่ม้าหมุนงานวัดคู่กับเป๊ปซี่ 🎠', '🎠');
    }
    pim.chatTimer = 5.5;
    pepsi.chatTimer = 5.5;
}

// =========================================================
// มินิเกมปาโป่งชิงตุ๊กตา
// =========================================================
let balloonsPopped = 0;
function startBalloonMinigame() {
    balloonsPopped = 0;
    document.getElementById('balloonScore').textContent = '0';
    const board = document.getElementById('balloonBoard');
    const balloonColors = ['🎈', '🔴', '🟡', '🔵', '🟣', '🟠'];
    board.innerHTML = Array.from({ length: 6 }, (_, idx) => `
        <button id="balloon-btn-${idx}" onclick="popBalloon(${idx})" class="h-16 rounded-2xl bg-white/10 hover:bg-white/20 text-3xl flex items-center justify-center active:scale-90 transition">
            ${balloonColors[idx % balloonColors.length]}
        </button>
    `).join('');
    openModal('modalBalloonGame');
}

function popBalloon(idx) {
    const btn = document.getElementById(`balloon-btn-${idx}`);
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '💥';
    btn.classList.add('opacity-40');
    playRanatNote(600 + balloonsPopped * 90, 0.15, 0.06);
    balloonsPopped++;
    document.getElementById('balloonScore').textContent = balloonsPopped;

    if (balloonsPopped >= 5) {
        setTimeout(() => {
            closeAllModals();
            playSuccessChime();
            pim.heldItem = { kind: 'souvenir', name: 'ตุ๊กตาหมีรางวัลปาโป่ง', icon: '🧸' };
            updateHeldItemUI();
            pim.chatText = 'เย้! ได้ตุ๊กตาหมีแล้ว ขอบคุณนะเป๊ปซี่ 🧸';
            pim.chatTimer = 4;
            pepsi.chatText = 'เพื่อพิม เป๊ปซี่เล็งแม่นอยู่แล้วครับ ❤️';
            pepsi.chatTimer = 5;
            showToast('ปาโป่งแตกครบ 5 ลูก! เป๊ปซี่คว้าตุ๊กตาหมีให้พิมแล้ว 🧸', '🎯');
        }, 350);
    }
}

function fillSampleWish(text) {
    document.getElementById('wishInput').value = text;
}

function confirmFloatKrathong() {
    const rawWish = document.getElementById('wishInput').value.trim();
    const pimWish = rawWish || 'ขอขมาพระแม่คงคา และขอให้พิมกับเป๊ปซี่รักกันและอยู่ด้วยกันไปนานๆ ❤️';
    const krathongType = pim.heldItem ? pim.heldItem.type : 'banana';
    const krathongDeco = pim.heldItem ? pim.heldItem.deco : 'lotus';
    const krathongName = pim.heldItem ? pim.heldItem.name : 'กระทงใบตอง';

    closeAllModals();
    pim.heldItem = null;
    updateHeldItemUI();

    pim.x = 1090;
    pim.y = 790;
    pepsi.x = 1150;
    pepsi.y = 790;
    pim.isPraying = true;
    pim.prayTimer = 2.6;
    pepsi.isPraying = true;
    pepsi.prayTimer = 2.6;

    pim.chatText = 'ขอขมาพระแม่คงคา สาธุ... 🙏✨';
    pim.chatTimer = 3.5;
    pepsi.chatText = 'เป๊ปซี่ก็อธิษฐานให้เราสองคนเหมือนกันครับ ❤️';
    pepsi.chatTimer = 3.5;

    playSuccessChime();

    setTimeout(() => {
        pim.isPraying = false;
        pepsi.isPraying = false;

        riverRipples.push({ x: 1120, y: RIVER_Y + 38, r: 8, alpha: 1 });

        floatingKrathongs.push({
            x: 1120,
            y: RIVER_Y + 38,
            vx: 14,
            type: krathongType,
            deco: krathongDeco,
            owner: 'พิม ❤️ เป๊ปซี่',
            wish: pimWish,
            bobOffset: 0,
            isSpecial: true
        });

        savedMemories.unshift({
            krathongName,
            pimWish,
            pepsiWish: 'สุขสันต์วันลอยกระทงนะพิม ขอบคุณที่อยู่ข้างๆ กันมาตลอด ขอให้เราสองคนรักกันและอยู่ด้วยกันไปนานๆ แบบนี้ทุกปีเลยนะ รักพิมที่สุดครับ ❤️',
            time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        });
        updateMemoriesUI();

        triggerCelebrationFireworks();

        setTimeout(() => {
            document.getElementById('pimSavedWishDisplay').textContent = `"${pimWish}"`;
            openModal('modalPepsiSurprise');
            playSuccessChime();
        }, 1200);
    }, 2400);
}

function closeSurpriseAndCelebrate() {
    closeAllModals();
    triggerCelebrationFireworks();
    pepsi.chatText = 'สุขสันต์วันลอยกระทงนะพิม อยู่ด้วยกันนานๆ เลย ❤️';
    pepsi.chatTimer = 6;
    for (let i = 0; i < 14; i++) {
        setTimeout(() => {
            spawnHeart(pim.x + (Math.random() * 100 - 50), pim.y - 30, '#fb7185');
        }, i * 120);
    }
}

// =========================================================
// จัดการหน้าต่าง Modal & แจ้งเตือน
// =========================================================

// =========================================================
// ระบบจุดทิ้งขยะแยกประเภท (เขียว เหลือง น้ำเงิน แดง)
// =========================================================
function getBinCategoryForItem(item) {
    if (!item) return { binColor: 'ถังสีน้ำเงิน (ขยะทั่วไป)', badgeClass: 'bg-sky-500/30 text-sky-200 border-sky-400/50' };
    if (item.kind === 'food' || item.kind === 'krathong') {
        return { binColor: 'ถังสีเขียว (ขยะเปียก/ย่อยสลายได้)', badgeClass: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50' };
    }
    if (item.kind === 'lantern') {
        return { binColor: 'ถังสีเหลือง (ขยะรีไซเคิล)', badgeClass: 'bg-amber-500/30 text-amber-200 border-amber-400/50' };
    }
    return { binColor: 'ถังสีน้ำเงิน (ขยะทั่วไป)', badgeClass: 'bg-sky-500/30 text-sky-200 border-sky-400/50' };
}

function openTrashBinModal() {
    renderTrashInventoryList();
    openModal('modalTrashBin');
}

function renderTrashInventoryList() {
    const container = document.getElementById('trashInventoryList');
    if (!container) return;

    const hasAnyItem = pim.inventory.some(item => item !== null);
    if (!hasAnyItem) {
        container.innerHTML = `
            <div class="text-center py-6 text-white/65 text-xs bg-white/5 rounded-2xl border border-white/10">
                ในกระเป๋าทั้ง 5 ช่องว่างเปล่า ไม่มีของให้ทิ้งเลย ✨
            </div>
        `;
        return;
    }

    container.innerHTML = pim.inventory.map((item, idx) => {
        if (!item) {
            return `
                <div class="flex items-center justify-between bg-white/5 rounded-xl px-3.5 py-2.5 border border-white/10 opacity-45">
                    <span class="text-xs text-white/60">ช่องที่ ${idx + 1}: ว่างเปล่า</span>
                </div>
            `;
        }
        const cat = getBinCategoryForItem(item);
        return `
            <div class="flex items-center justify-between bg-white/10 rounded-xl px-3.5 py-2.5 border border-amber-300/25 gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-2xl shrink-0">${item.icon}</span>
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white truncate">ช่อง ${idx + 1}: ${item.name}</div>
                        <span class="inline-block text-[10px] px-2 py-0.5 rounded-full border ${cat.badgeClass} mt-0.5">${cat.binColor}</span>
                    </div>
                </div>
                <button onclick="discardInventorySlot(${idx})" class="shrink-0 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow active:scale-95 transition">
                    ทิ้งลงถัง 🗑️
                </button>
            </div>
        `;
    }).join('');
}

function discardInventorySlot(slotIdx) {
    const item = pim.inventory[slotIdx];
    if (!item) return;
    const cat = getBinCategoryForItem(item);
    pim.inventory[slotIdx] = null;
    updateHeldItemUI();
    renderTrashInventoryList();
    playRanatNote(523.25, 0.16, 0.05);

    pim.chatText = `ทิ้ง${item.name}ลง${cat.binColor}เรียบร้อย 🌱`;
    pim.chatTimer = 3.5;
    pepsi.chatText = 'แยกขยะเก่งจังเลยพิม ช่วยกันรักษาความสะอาดในงานวัดนะ ❤️';
    pepsi.chatTimer = 4.5;
    showToast(`ทิ้ง "${item.name}" ลง${cat.binColor}แล้ว`, '🗑️');
}

function openModal(modalId) {
    document.getElementById('modalBackdrop').classList.remove('hidden');
    ['modalKrathongShop', 'modalLanternShop', 'modalAnimalShop', 'modalStreetFood', 'modalThaiDessert', 'modalSouvenirShop', 'modalBalloonGame', 'modalWish', 'modalPepsiSurprise', 'modalTrashBin', 'modalMusicPlayer', 'modalMemories'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(modalId).classList.remove('hidden');
}

function closeAllModals() {
    document.getElementById('modalBackdrop').classList.add('hidden');
}

function isAnyModalOpen() {
    return !document.getElementById('modalBackdrop').classList.contains('hidden');
}

function openMemoriesModal() {
    openModal('modalMemories');
}

function updateMemoriesUI() {
    const badge = document.getElementById('wishBadge');
    const list = document.getElementById('memoriesList');
    if (savedMemories.length > 0) {
        badge.classList.remove('hidden');
        badge.textContent = savedMemories.length;
        list.innerHTML = savedMemories.map((m, i) => `
            <div class="bg-white/10 rounded-2xl p-3.5 border border-amber-300/30">
                <div class="flex justify-between text-xs text-amber-300 mb-1">
                    <span>✨ ${m.krathongName} (ครั้งที่ ${savedMemories.length - i})</span>
                    <span>${m.time} น.</span>
                </div>
                <div class="text-pink-200 text-xs mb-1.5"><b>พิมอธิษฐาน:</b> "${m.pimWish}"</div>
                <div class="text-amber-100 text-xs"><b>เป๊ปซี่ถึงพิม:</b> "${m.pepsiWish}"</div>
            </div>
        `).join('');
    }
}

let toastTimeout = null;
function showToast(text, icon = '✨') {
    const banner = document.getElementById('toastBanner');
    document.getElementById('toastText').textContent = text;
    document.getElementById('toastIcon').textContent = icon;
    banner.classList.remove('opacity-0', '-translate-y-4');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        banner.classList.add('opacity-0', '-translate-y-4');
    }, 3600);
}

// =========================================================
// เอฟเฟกต์พลุ หัวใจ และโคมลอย
// =========================================================
function spawnHeart(x, y, color = '#fb7185') {
    floatingHearts.push({
        x: x + (Math.random() * 24 - 12),
        y,
        vy: -35 - Math.random() * 25,
        alpha: 1,
        scale: 0.7 + Math.random() * 0.5,
        color
    });
}

function spawnFirework(x, y) {
    const colors = ['#fde047', '#fb7185', '#38bdf8', '#c084fc', '#4ade80', '#fb923c'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const particles = [];
    for (let i = 0; i < 38; i++) {
        const angle = (Math.PI * 2 * i) / 38;
        const speed = 70 + Math.random() * 95;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            color
        });
    }
    fireworks.push({ particles });
    playRanatNote(300 + Math.random() * 400, 0.25, 0.04);
}

function triggerCelebrationFireworks() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const fx = camera.x + canvas.width * (0.2 + Math.random() * 0.6);
            const fy = 85 + Math.random() * 140;
            spawnFirework(fx, fy);
        }, i * 380);
    }
}

setInterval(() => {
    if (!gameStarted) return;
    if (skyLanterns.length < 9) {
        skyLanterns.push({
            x: Math.random() * WORLD_WIDTH,
            y: 320 + Math.random() * 120,
            vy: -16 - Math.random() * 10,
            sway: Math.random() * Math.PI * 2,
            scale: 0.6 + Math.random() * 0.35,
            bodyColor: '#fb923c',
            glowColor: '#fef08a',
            label: ''
        });
    }
    if (Math.random() < 0.45) {
        spawnFirework(250 + Math.random() * (WORLD_WIDTH - 500), 80 + Math.random() * 120);
    }
}, 3200);

// =========================================================
// อัปเดตตำแหน่งตัวละครและการเคลื่อนไหว (Game Loop Update)
// =========================================================
function update(dt) {
    if (!gameStarted) return;

    if (pim.prayTimer > 0) {
        pim.prayTimer -= dt;
        if (pim.prayTimer <= 0) pim.isPraying = false;
    }
    if (pepsi.prayTimer > 0) {
        pepsi.prayTimer -= dt;
        if (pepsi.prayTimer <= 0) pepsi.isPraying = false;
    }

    // 1. กรณีกำลังนั่งชิงช้าสวรรค์หรือม้าหมุน
    if (rideState.active) {
        rideState.timer -= dt;
        rideState.angle += dt * 1.1;

        if (rideState.type === 'ferris') {
            const cx = 2640, cy = 285, r = 110;
            const gx = cx + Math.cos(rideState.angle) * r;
            const gy = cy + Math.sin(rideState.angle) * r + 28;
            pim.x = gx - 14;
            pim.y = gy;
            pepsi.x = gx + 14;
            pepsi.y = gy;
        } else if (rideState.type === 'carousel') {
            const cx = 2880, cy = 545;
            const offset = Math.sin(rideState.angle * 2) * 35;
            const bob = Math.sin(rideState.angle * 4) * 8;
            pim.x = cx + offset - 16;
            pim.y = cy + bob;
            pepsi.x = cx + offset + 18;
            pepsi.y = cy - bob;
        }

        if (Math.random() < 0.15) spawnHeart((pim.x + pepsi.x) / 2, pim.y - 55, '#fb7185');

        if (rideState.timer <= 0) {
            rideState.active = false;
            if (rideState.type === 'ferris') {
                pim.x = 2625; pim.y = 515;
                pepsi.x = 2665; pepsi.y = 515;
            } else {
                pim.x = 2865; pim.y = 620;
                pepsi.x = 2905; pepsi.y = 620;
            }
            showToast('ลงจากเครื่องเล่นเรียบร้อย สนุกสุดๆ เลย ❤️', '✨');
        }
    } else {
        // 2. การเดินปกติของพิม
        let moveX = 0;
        let moveY = 0;

        if (joystick.active) {
            moveX = joystick.dx;
            moveY = joystick.dy;
        } else {
            if (keys['arrowleft'] || keys['a']) moveX -= 1;
            if (keys['arrowright'] || keys['d']) moveX += 1;
            if (keys['arrowup'] || keys['w']) moveY -= 1;
            if (keys['arrowdown'] || keys['s']) moveY += 1;
        }

        if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY);
            moveX /= len;
            moveY /= len;
            pim.x += moveX * pim.speed * dt;
            pim.y += moveY * pim.speed * dt;
            pim.walkCycle += dt * 11;
            if (Math.abs(moveX) > 0.1) pim.facing = moveX > 0 ? 1 : -1;
        } else if (pim.targetX !== null && pim.targetY !== null) {
            const dx = pim.targetX - pim.x;
            const dy = pim.targetY - pim.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 6) {
                pim.x += (dx / dist) * pim.speed * dt;
                pim.y += (dy / dist) * pim.speed * dt;
                pim.walkCycle += dt * 11;
                if (Math.abs(dx) > 2) pim.facing = dx > 0 ? 1 : -1;
            } else {
                pim.targetX = null;
                pim.targetY = null;
            }
        }

        pim.x = Math.max(70, Math.min(WORLD_WIDTH - 70, pim.x));
        pim.y = Math.max(PROMENADE_TOP + 60, Math.min(RIVER_Y - 10, pim.y));

        // 3. AI เป๊ปซี่เดินตามพิมอย่างนุ่มนวล
        const followOffsetX = pim.facing === 1 ? -54 : 54;
        const desiredPepsiX = pim.x + followOffsetX;
        const desiredPepsiY = pim.y + 6;
        const pDx = desiredPepsiX - pepsi.x;
        const pDy = desiredPepsiY - pepsi.y;
        const pDist = Math.hypot(pDx, pDy);

        if (pDist > 10 && !pepsi.isPraying) {
            const catchupSpeed = pDist > 160 ? pepsi.speed * 1.35 : pepsi.speed * 0.96;
            pepsi.x += (pDx / pDist) * catchupSpeed * dt;
            pepsi.y += (pDy / pDist) * catchupSpeed * dt;
            pepsi.walkCycle += dt * 11;
            if (Math.abs(pDx) > 3) pepsi.facing = pDx > 0 ? 1 : -1;
        } else {
            pepsi.facing = pim.x >= pepsi.x ? 1 : -1;
        }
    }

    if (pim.chatTimer > 0) pim.chatTimer -= dt;
    if (pepsi.chatTimer > 0) {
        pepsi.chatTimer -= dt;
    } else {
        pepsi.idleTimer += dt;
        if (pepsi.idleTimer > 8.5) {
            pepsi.idleTimer = 0;
            pepsi.chatText = pepsiSweetPhrases[Math.floor(Math.random() * pepsiSweetPhrases.length)];
            pepsi.chatTimer = 4.5;
            spawnHeart(pepsi.x, pepsi.y - 55, '#fb7185');
        }
    }

    pepsi.heartTimer += dt;
    if (pepsi.heartTimer > 3.8) {
        pepsi.heartTimer = 0;
        spawnHeart(pepsi.x, pepsi.y - 50, '#f472b6');
    }

    // 4. ตรวจสอบระยะใกล้ร้านค้า เครื่องเล่น หรือท่าน้ำ
    let nearest = null;
    let minDist = Infinity;
    if (!rideState.active) {
        for (const stall of stalls) {
            const d = Math.hypot(pim.x - stall.interactX, pim.y - stall.interactY);
            if (d < stall.radius && d < minDist) {
                minDist = d;
                nearest = stall;
            }
        }
    }
    activeInteractTarget = nearest;
    updateInteractButton(nearest);

    // 5. อัปเดตกระทง ปลา ระลอกน้ำ สัตว์ที่ปล่อยทำบุญ โคมลอย พลุ และหัวใจ
    for (const k of floatingKrathongs) {
        k.x += k.vx * dt;
        k.bobOffset += dt * 2.5;
        if (k.x > WORLD_WIDTH + 80) k.x = -80;
    }

    for (const f of riverFish) {
        f.x += f.vx * dt;
        f.phase += dt * 5;
        if (f.x > WORLD_WIDTH + 40) f.x = -40;
        if (f.x < -40) f.x = WORLD_WIDTH + 40;
    }

    for (let i = riverRipples.length - 1; i >= 0; i--) {
        const rp = riverRipples[i];
        rp.r += 24 * dt;
        rp.alpha -= 0.45 * dt;
        if (rp.alpha <= 0) riverRipples.splice(i, 1);
    }

    for (let i = releasedAnimals.length - 1; i >= 0; i--) {
        const a = releasedAnimals[i];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.timer -= dt;
        if (a.timer < 1.2) a.alpha = Math.max(0, a.timer / 1.2);
        if (a.timer <= 0) releasedAnimals.splice(i, 1);
    }

    for (let i = skyLanterns.length - 1; i >= 0; i--) {
        const l = skyLanterns[i];
        l.y += l.vy * dt;
        l.sway += dt * 1.8;
        l.x += Math.sin(l.sway) * 14 * dt;
        if (l.y < -120) skyLanterns.splice(i, 1);
    }

    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        let alive = false;
        for (const p of fw.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 45 * dt;
            p.alpha -= dt * 0.85;
            if (p.alpha > 0) alive = true;
        }
        if (!alive) fireworks.splice(i, 1);
    }

    for (let i = floatingHearts.length - 1; i >= 0; i--) {
        const h = floatingHearts[i];
        h.y += h.vy * dt;
        h.alpha -= dt * 0.65;
        if (h.alpha <= 0) floatingHearts.splice(i, 1);
    }

    // 6. กล้องติดตามตัวละครพิมและเป๊ปซี่
    const midX = (pim.x + pepsi.x) / 2;
    const midY = (pim.y + pepsi.y) / 2;
    const targetCamX = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, midX - canvas.width / 2));
    const targetCamY = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, midY - canvas.height * 0.55));
    camera.x += (targetCamX - camera.x) * Math.min(1, dt * 5);
    camera.y += (targetCamY - camera.y) * Math.min(1, dt * 5);
}

function updateInteractButton(target) {
    const btn = document.getElementById('btnInteract');
    const icon = document.getElementById('interactIcon');
    const title = document.getElementById('interactTitle');
    const sub = document.getElementById('interactSub');

    if (rideState.active) {
        btn.classList.add('opacity-40', 'pointer-events-none');
        btn.classList.remove('btn-glow');
        icon.textContent = rideState.type === 'ferris' ? '🎡' : '🎠';
        title.textContent = 'กำลังเล่นเครื่องเล่น';
        sub.textContent = 'ชมวิวงานวัดกับเป๊ปซี่...';
        return;
    }

    if (target) {
        btn.classList.remove('opacity-40', 'pointer-events-none');
        btn.classList.add('btn-glow');
        icon.textContent = target.icon;
        if (target.id === 'pier') {
            if (pim.heldItem && pim.heldItem.kind === 'krathong') {
                title.textContent = 'ลอยกระทงอธิษฐาน ❤️';
                sub.textContent = 'กดเพื่อขอขมาพระแม่คงคาและอธิษฐาน';
            } else {
                title.textContent = 'ท่าน้ำลอยกระทง';
                sub.textContent = 'แวะร้านขายกระทงก่อนนะ';
            }
        } else if (target.id === 'releasespot') {
            if (pim.heldItem && pim.heldItem.kind === 'animal') {
                icon.textContent = pim.heldItem.icon;
                title.textContent = `ปล่อย${pim.heldItem.name} 🙏`;
                sub.textContent = 'กดเพื่อยกมือไหว้และปล่อยทำบุญร่วมกัน';
            } else {
                title.textContent = 'จุดปล่อยปลาและปล่อยสัตว์ทำบุญ';
                sub.textContent = 'แวะร้านขายสัตว์ทำบุญปล่อยชีวิตก่อนนะ';
            }
        } else {
            title.textContent = target.name;
            sub.textContent = target.sub;
        }
    } else {
        btn.classList.add('opacity-40', 'pointer-events-none');
        btn.classList.remove('btn-glow');
        icon.textContent = '✨';
        title.textContent = 'เดินเที่ยวงาน';
        sub.textContent = 'เดินไปใกล้ร้านค้า เครื่องเล่น หรือท่าน้ำ';
    }
}

// =========================================================
// การวาดฉากงานวัด เครื่องเล่น และตัวละคร 2D บน Canvas
// =========================================================
function draw(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 1. ท้องฟ้ายามค่ำคืนและดวงดาว
    const skyGrad = ctx.createLinearGradient(0, 0, 0, PROMENADE_TOP);
    skyGrad.addColorStop(0, '#060919');
    skyGrad.addColorStop(0.55, '#131842');
    skyGrad.addColorStop(1, '#261e54');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WORLD_WIDTH, PROMENADE_TOP);

    for (const s of stars) {
        const alpha = 0.4 + 0.6 * Math.sin(time * 0.003 + s.twinkle);
        ctx.fillStyle = `rgba(255, 250, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // พระจันทร์เต็มดวง
    const moonX = 1750, moonY = 105;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 130);
    moonGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    moonGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.3)');
    moonGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();

    // วัดไทยโบราณฉากหลัง
    drawTempleSilhouette(180, PROMENADE_TOP);

    // พลุเฉลิมฉลอง
    for (const fw of fireworks) {
        for (const p of fw.particles) {
            if (p.alpha <= 0) continue;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    // 2. ลานทางเดินงานวัดและแนวเสาไฟ
    const groundGrad = ctx.createLinearGradient(0, PROMENADE_TOP, 0, RIVER_Y);
    groundGrad.addColorStop(0, '#2a223d');
    groundGrad.addColorStop(0.5, '#3b2f4a');
    groundGrad.addColorStop(1, '#261e35');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, PROMENADE_TOP, WORLD_WIDTH, RIVER_Y - PROMENADE_TOP);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let y = PROMENADE_TOP + 40; y < RIVER_Y; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_WIDTH, y);
        ctx.stroke();
    }

    drawFestiveGarlands(time);

    // 3. ร้านค้าและเวทีการแสดงในงานวัด
    for (const stall of stalls) {
        if (['temple', 'lanternshop', 'animalshop', 'krathong', 'streetfood', 'dessert', 'souvenir', 'stage', 'balloon'].includes(stall.id)) {
            drawStall(stall, activeInteractTarget && activeInteractTarget.id === stall.id);
        }
    }

    // 4. เครื่องเล่นงานวัดขนาดใหญ่ (ชิงช้าสวรรค์ และ ม้าหมุน)
    const ferrisAngle = rideState.active && rideState.type === 'ferris' ? rideState.angle : time * 0.00055;
    drawInteractiveFerrisWheel(2640, 285, ferrisAngle, activeInteractTarget && activeInteractTarget.id === 'ferris');
    drawInteractiveCarousel(2880, 545, time * 0.002, activeInteractTarget && activeInteractTarget.id === 'carousel');

    // 5. แม่น้ำเจ้าพระยายามค่ำคืน เงาสะท้อนพระจันทร์ และฝูงปลา
    const riverGrad = ctx.createLinearGradient(0, RIVER_Y, 0, WORLD_HEIGHT);
    riverGrad.addColorStop(0, '#0b1938');
    riverGrad.addColorStop(0.4, '#0f254e');
    riverGrad.addColorStop(1, '#060e24');
    ctx.fillStyle = riverGrad;
    ctx.fillRect(0, RIVER_Y, WORLD_WIDTH, WORLD_HEIGHT - RIVER_Y);

    for (let i = 0; i < 16; i++) {
        const ry = RIVER_Y + 20 + i * 20;
        const rw = 55 - i * 2 + Math.sin(time * 0.004 + i) * 14;
        ctx.fillStyle = `rgba(254, 240, 138, ${0.18 - i * 0.008})`;
        ctx.fillRect(moonX - rw / 2, ry, rw, 5);
    }

    for (const f of riverFish) {
        ctx.save();
        ctx.translate(f.x, f.y);
        if (f.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = 'rgba(125, 211, 252, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 1.6, f.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        const tailWag = Math.sin(f.phase) * 3;
        ctx.beginPath();
        ctx.moveTo(-f.size * 1.4, 0);
        ctx.lineTo(-f.size * 2.3, -4 + tailWag);
        ctx.lineTo(-f.size * 2.3, 4 + tailWag);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    for (const rp of riverRipples) {
        ctx.save();
        ctx.strokeStyle = `rgba(186, 230, 253, ${Math.max(0, rp.alpha)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r * 1.8, rp.r * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(0, RIVER_Y - 12, WORLD_WIDTH, 18);
    ctx.fillStyle = '#855834';
    ctx.fillRect(0, RIVER_Y - 12, WORLD_WIDTH, 5);

    // 6. ท่าน้ำไม้สำหรับลอยกระทง + จุดทิ้งขยะ 4 สี + จุดปล่อยปลาและปล่อยสัตว์ทำบุญ
    drawWoodenPier(1120, RIVER_Y, activeInteractTarget && activeInteractTarget.id === 'pier');
    drawFourColorTrashBins(560, 810, activeInteractTarget && activeInteractTarget.id === 'trashbin');
    drawRiversideSpot(1650, RIVER_Y, '🐟 จุดปล่อยปลาและปล่อยสัตว์ทำบุญ', activeInteractTarget && activeInteractTarget.id === 'releasespot');

    // 7. กระทงที่ลอยอยู่ในแม่น้ำ
    for (const k of floatingKrathongs) drawRiverKrathong(k, time);

    // 8. สัตว์ที่พิมและเป๊ปซี่ปล่อยคืนสู่ธรรมชาติ
    for (const a of releasedAnimals) {
        ctx.save();
        ctx.globalAlpha = a.alpha;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.icon, a.x, a.y);
        ctx.restore();
    }

    // 9. ตัวละครเป๊ปซี่และพิม
    const characters = [
        { type: 'pepsi', obj: pepsi },
        { type: 'pim', obj: pim }
    ].sort((a, b) => a.obj.y - b.obj.y);

    for (const c of characters) {
        if (c.type === 'pepsi') drawPepsi(pepsi);
        else drawPim(pim);
    }

    // 10. โคมลอยที่ลอยขึ้นฟ้า (วาดทับด้านบนสุดเพื่อให้เห็นตอนลอยขึ้นจากตรงที่ยืนชัดเจนสวยงาม!)
    for (const l of skyLanterns) drawSkyLantern(l);

    if (pim.targetX !== null && pim.targetY !== null) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pim.targetX, pim.targetY, 10 + Math.sin(time * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    for (const h of floatingHearts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, h.alpha);
        ctx.fillStyle = h.color;
        ctx.font = `${Math.round(20 * h.scale)}px sans-serif`;
        ctx.fillText('❤️', h.x - 10, h.y);
        ctx.restore();
    }

    ctx.restore();
}

function drawTempleSilhouette(x, baseY) {
    ctx.fillStyle = '#181636';
    ctx.beginPath();
    ctx.moveTo(x - 45, baseY);
    ctx.lineTo(x - 22, baseY - 110);
    ctx.lineTo(x, baseY - 175);
    ctx.lineTo(x + 22, baseY - 110);
    ctx.lineTo(x + 45, baseY);
    ctx.fill();

    ctx.fillStyle = '#241f4d';
    ctx.fillRect(x + 55, baseY - 65, 130, 65);
    ctx.beginPath();
    ctx.moveTo(x + 40, baseY - 65);
    ctx.lineTo(x + 120, baseY - 115);
    ctx.lineTo(x + 200, baseY - 65);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 175);
    ctx.lineTo(x, baseY - 190);
    ctx.stroke();
}

function drawInteractiveFerrisWheel(cx, cy, angle, isHighlighted) {
    const r = 110;
    ctx.save();
    ctx.translate(cx, cy);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 225, 85, 28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-65, 210);
    ctx.lineTo(0, 0);
    ctx.lineTo(65, 210);
    ctx.stroke();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    const cabinColors = ['#fb7185', '#fde047', '#38bdf8', '#c084fc', '#4ade80', '#fb923c'];
    for (let i = 0; i < 10; i++) {
        const a = angle + (Math.PI * 2 * i) / 10;
        const gx = Math.cos(a) * r;
        const gy = Math.sin(a) * r;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(gx, gy);
        ctx.stroke();

        ctx.fillStyle = cabinColors[i % cabinColors.length];
        ctx.beginPath();
        ctx.roundRect(gx - 12, gy - 4, 24, 16, 5);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15, 20, 45, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-72, 185, 144, 26, 12);
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#fde047' : 'rgba(56, 189, 248, 0.6)';
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px Prompt, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎡 ชิงช้าสวรรค์', 0, 202);

    ctx.restore();
}

function drawInteractiveCarousel(cx, cy, timeAngle, isHighlighted) {
    ctx.save();
    ctx.translate(cx, cy);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 70, 82, 26, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle = '#be185d';
    ctx.beginPath();
    ctx.ellipse(0, 42, 74, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.ellipse(0, 38, 70, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.fillRect(-6, -48, 12, 86);

    [-36, 0, 36].forEach((mx, idx) => {
        const bob = Math.sin(timeAngle * 2 + idx * 2) * 6;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx, -45);
        ctx.lineTo(mx, 32);
        ctx.stroke();

        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎠', mx, 8 + bob);
    });

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(-78, -42);
    ctx.lineTo(0, -86);
    ctx.lineTo(78, -42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 20, 45, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-65, -112, 130, 24, 11);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 12px Prompt, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎠 ม้าหมุนงานวัด', 0, -96);

    ctx.restore();
}

function drawFestiveGarlands(time) {
    const bulbColors = ['#fde047', '#fb7185', '#38bdf8', '#4ade80', '#fb923c'];
    for (let x = 80; x < WORLD_WIDTH; x += 260) {
        ctx.fillStyle = '#4a3219';
        ctx.fillRect(x - 4, PROMENADE_TOP - 25, 8, 55);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, PROMENADE_TOP - 20);
        ctx.quadraticCurveTo(x + 130, PROMENADE_TOP + 18, x + 260, PROMENADE_TOP - 20);
        ctx.stroke();

        for (let b = 1; b <= 6; b++) {
            const t = b / 7;
            const bx = x + t * 260;
            const by = (PROMENADE_TOP - 20) + 4 * t * (1 - t) * 38;
            const col = bulbColors[(b + Math.floor(time * 0.002)) % bulbColors.length];
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(bx, by + 3, 4.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawStall(stall, isHighlighted) {
    ctx.save();
    ctx.translate(stall.x, stall.y);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 80, 74, 26, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(-62, -45, 7, 95);
    ctx.fillRect(55, -45, 7, 95);

    ctx.fillStyle = '#7c4d2b';
    ctx.fillRect(-68, 12, 136, 38);
    ctx.fillStyle = '#a47148';
    ctx.fillRect(-70, 8, 140, 8);

    const stripes = 6;
    const sw = 148 / stripes;
    for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? stall.color : '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(-74 + i * sw, -45);
        ctx.lineTo(-74 + (i + 1) * sw, -45);
        ctx.lineTo(-78 + (i + 1) * sw, -18);
        ctx.lineTo(-78 + i * sw, -18);
        ctx.fill();
    }

    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stall.icon, 0, 2);

    ctx.font = 'bold 11px Prompt, sans-serif';
    const tagW = Math.max(150, ctx.measureText(stall.name).width + 24);
    ctx.fillStyle = 'rgba(15, 20, 45, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-tagW / 2, -82, tagW, 25, 12);
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#fde047' : 'rgba(253, 224, 71, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.fillText(stall.name, 0, -65);

    ctx.restore();
}


function drawFourColorTrashBins(cx, riverY, isHighlighted) {
    ctx.save();
    ctx.translate(cx, riverY);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.ellipse(0, -8, 78, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // วาดถังขยะ 4 สีเรียงกัน (เขียว เหลือง น้ำเงิน แดง)
    const bins = [
        { body: '#10b981', lid: '#6ee7b7', offsetX: -39 }, // เขียว
        { body: '#f59e0b', lid: '#fde047', offsetX: -13 }, // เหลือง
        { body: '#0ea5e9', lid: '#7dd3fc', offsetX: 13 },  // น้ำเงิน
        { body: '#ef4444', lid: '#fda4af', offsetX: 39 }   // แดง
    ];

    for (const b of bins) {
        // ตัวถังขยะ
        ctx.fillStyle = b.body;
        ctx.beginPath();
        ctx.roundRect(b.offsetX - 10, -34, 20, 26, [2, 2, 5, 5]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // ฝาถังขยะด้านบน
        ctx.fillStyle = b.lid;
        ctx.beginPath();
        ctx.roundRect(b.offsetX - 11.5, -39, 23, 6, 3);
        ctx.fill();
        ctx.stroke();

        // ช่องทิ้งตรงฝาถัง
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fillRect(b.offsetX - 5, -37, 10, 2.2);
    }

    const label = '🗑️ จุดทิ้งขยะ 4 สี';
    ctx.font = 'bold 11px Prompt, sans-serif';
    const w = Math.max(145, ctx.measureText(label).width + 22);
    ctx.fillStyle = 'rgba(15, 20, 45, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, 4, w, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 20);

    ctx.restore();
}

function drawRiversideSpot(cx, riverY, label, isHighlighted) {
    ctx.save();
    ctx.translate(cx, riverY);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.ellipse(0, -18, 72, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.font = 'bold 11px Prompt, sans-serif';
    const w = Math.max(155, ctx.measureText(label).width + 24);
    ctx.fillStyle = 'rgba(15, 20, 45, 0.88)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, 4, w, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 20);

    ctx.restore();
}

function drawWoodenPier(cx, riverY, isHighlighted) {
    ctx.save();
    ctx.translate(cx, riverY);

    if (isHighlighted) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, -5, 105, 30, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle = '#6b4226';
    ctx.fillRect(-105, -8, 210, 64);

    ctx.strokeStyle = '#4a2c18';
    ctx.lineWidth = 2;
    for (let y = 2; y < 52; y += 11) {
        ctx.beginPath();
        ctx.moveTo(-105, y);
        ctx.lineTo(105, y);
        ctx.stroke();
    }

    [-102, 102].forEach(px => {
        ctx.fillStyle = '#4a2c18';
        ctx.fillRect(px - 6, -34, 12, 90);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, -36, 7, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-102, -26);
    ctx.quadraticCurveTo(-60, -6, -28, -24);
    ctx.moveTo(28, -24);
    ctx.quadraticCurveTo(60, -6, 102, -26);
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 20, 45, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-78, 60, 156, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px Prompt, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌊 ท่าน้ำลอยกระทง', 0, 76);

    ctx.restore();
}

function drawRiverKrathong(k, time) {
    const bobY = k.y + Math.sin(time * 0.004 + k.bobOffset) * 3;
    const scale = k.isSpecial ? 1.35 : 0.95;

    drawDetailedKrathongShape(ctx, k.x, bobY, k.type, k.deco || 'lotus', scale, time);

    if (k.owner) {
        ctx.save();
        ctx.font = 'bold 12px Mali, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText(k.owner, k.x, bobY - 36);
        ctx.restore();
    }
}

function drawSkyLantern(l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(l.scale, l.scale);

    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, l.glowColor || 'rgba(251, 146, 60, 0.88)');
    glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = l.bodyColor || '#fb923c';
    ctx.beginPath();
    ctx.moveTo(-13, -17);
    ctx.lineTo(13, -17);
    ctx.lineTo(9, 13);
    ctx.lineTo(-9, 13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 5, 5.5, 0, Math.PI * 2);
    ctx.fill();

    if (l.label) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px Mali, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.label, 0, -24);
    }

    ctx.restore();
}

// =========================================================
// การวาดตัวละคร "พิม" และ "เป๊ปซี่" (พร้อมท่าทางยกมือไหว้)
// =========================================================
function drawPim(p) {
    const bounce = (p.isPraying || rideState.active) ? 2 : Math.abs(Math.sin(p.walkCycle)) * 4;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (!rideState.active) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.translate(0, -bounce);

    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.moveTo(-11, -24);
    ctx.lineTo(11, -24);
    ctx.lineTo(13, 0);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(12, -4);
    ctx.stroke();

    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.roundRect(-10, -42, 20, 19, 6);
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-10, -42);
    ctx.lineTo(-2, -42);
    ctx.lineTo(11, -23);
    ctx.lineTo(4, -23);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(0, -54, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-13, -54, 26, 20);

    ctx.fillStyle = '#fde6d8';
    ctx.beginPath();
    ctx.arc(0, -52, 11.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(0, -55, 11.5, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(9, -60, 4, 0, Math.PI * 2);
    ctx.fill();

    const eyeOffset = p.facing * 2.5;
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(-3.5 + eyeOffset, -51, 1.6, 0, Math.PI * 2);
    ctx.arc(3.5 + eyeOffset, -51, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.arc(-5.5 + eyeOffset, -48.5, 2.3, 0, Math.PI * 2);
    ctx.arc(5.5 + eyeOffset, -48.5, 2.3, 0, Math.PI * 2);
    ctx.fill();

    if (p.isPraying) {
        // วงแสงออร่าสีทองชมพูละมุนรอบตัวตอนยกมือไหว้
        const aura = ctx.createRadialGradient(0, -35, 4, 0, -35, 36);
        aura.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        aura.addColorStop(0.6, 'rgba(244, 114, 182, 0.2)');
        aura.addColorStop(1, 'rgba(244, 114, 182, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, -35, 36, 0, Math.PI * 2);
        ctx.fill();

        // แขนยกขึ้นพนมมือระดับอกอย่างอ่อนช้อย
        ctx.strokeStyle = '#fbcfe8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-9, -37);
        ctx.quadraticCurveTo(-5, -31, -1.5, -34);
        ctx.moveTo(9, -37);
        ctx.quadraticCurveTo(5, -31, 1.5, -34);
        ctx.stroke();

        // วาดมือพนมเรียวสวยสีเนื้อ
        ctx.fillStyle = '#fde6d8';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -42);
        ctx.quadraticCurveTo(-4, -36, -2.5, -31);
        ctx.lineTo(2.5, -31);
        ctx.quadraticCurveTo(4, -36, 0, -42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (p.heldItem) {
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.heldItem.icon, p.facing * 14, -26);
    }

    drawNameTag('พิม', '#f472b6', -74);
    if (p.chatTimer > 0 && p.chatText) {
        drawSpeechBubble(p.chatText, -96, '#fdf2f8', '#9d174d');
    }

    ctx.restore();
}

function drawPepsi(p) {
    const bounce = (p.isPraying || rideState.active) ? 2 : Math.abs(Math.sin(p.walkCycle)) * 4;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (!rideState.active) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.translate(0, -bounce);

    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.roundRect(-12, -25, 24, 23, 5);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.roundRect(-11, -45, 22, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-11, -26, 22, 4);

    ctx.fillStyle = '#f6d5c3';
    ctx.beginPath();
    ctx.arc(0, -56, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(0, -59, 12.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();

    const eyeOffset = p.facing * 2.5;
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.arc(-3.8 + eyeOffset, -55, 1.7, 0, Math.PI * 2);
    ctx.arc(3.8 + eyeOffset, -55, 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(eyeOffset, -52, 3, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    if (p.isPraying) {
        // วงแสงออร่าสีทองอบอุ่นรอบตัวเป๊ปซี่ตอนยกมือไหว้
        const aura = ctx.createRadialGradient(0, -37, 4, 0, -37, 38);
        aura.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
        aura.addColorStop(0.6, 'rgba(56, 189, 248, 0.18)');
        aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, -37, 38, 0, Math.PI * 2);
        ctx.fill();

        // แขนยกขึ้นพนมมือระดับอก
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-10, -39);
        ctx.quadraticCurveTo(-5, -32, -1.5, -35);
        ctx.moveTo(10, -39);
        ctx.quadraticCurveTo(5, -32, 1.5, -35);
        ctx.stroke();

        // วาดมือพนมสีเนื้อ
        ctx.fillStyle = '#f6d5c3';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.quadraticCurveTo(-4.5, -37, -2.5, -32);
        ctx.lineTo(2.5, -32);
        ctx.quadraticCurveTo(4.5, -37, 0, -44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawNameTag('เป๊ปซี่', '#38bdf8', -78);
    if (p.chatTimer > 0 && p.chatText) {
        drawSpeechBubble(p.chatText, -100, '#eff6ff', '#1e3a8a');
    }

    ctx.restore();
}

function drawNameTag(name, accentColor, yOffset) {
    ctx.save();
    ctx.font = 'bold 12px Prompt, sans-serif';
    const w = ctx.measureText(name).width + 18;
    ctx.fillStyle = 'rgba(10, 14, 35, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, yOffset - 13, w, 18, 9);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, yOffset);
    ctx.restore();
}

function drawSpeechBubble(text, yOffset, bgColor, textColor) {
    ctx.save();
    ctx.font = '500 12px Mali, sans-serif';
    const maxW = 215;
    const textW = Math.min(maxW, ctx.measureText(text).width + 22);
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(-textW / 2, yOffset - 22, textW, 26, 12);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    const display = text.length > 35 ? text.slice(0, 34) + '...' : text;
    ctx.fillText(display, 0, yOffset - 5);
    ctx.restore();
}

// =========================================================
// จัดการขนาดหน้าจอและเริ่ม Loop เกม
// =========================================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lastTime = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
