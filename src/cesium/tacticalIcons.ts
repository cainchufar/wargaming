import { FACTION_META } from '../simulation/scenarioData';
import type { FactionId, UnitClass } from '../simulation/types';

const iconCache = new Map<string, string>();

function drawAircraftPath(ctx: CanvasRenderingContext2D, unitClass: UnitClass) {
  ctx.beginPath();
  if (unitClass === 'fighter') {
    ctx.moveTo(0, -24);
    ctx.lineTo(4.5, -9);
    ctx.lineTo(22, 6);
    ctx.lineTo(22, 11);
    ctx.lineTo(5.5, 8);
    ctx.lineTo(4.5, 16);
    ctx.lineTo(11, 21);
    ctx.lineTo(11, 24);
    ctx.lineTo(0, 20);
    ctx.lineTo(-11, 24);
    ctx.lineTo(-11, 21);
    ctx.lineTo(-4.5, 16);
    ctx.lineTo(-5.5, 8);
    ctx.lineTo(-22, 11);
    ctx.lineTo(-22, 6);
    ctx.lineTo(-4.5, -9);
    ctx.closePath();
  } else if (unitClass === 'bomber') {
    ctx.moveTo(0, -25);
    ctx.lineTo(4, -10);
    ctx.lineTo(26, 2);
    ctx.lineTo(26, 8);
    ctx.lineTo(5, 4);
    ctx.lineTo(4, 17);
    ctx.lineTo(12, 22);
    ctx.lineTo(12, 25);
    ctx.lineTo(0, 22);
    ctx.lineTo(-12, 25);
    ctx.lineTo(-12, 22);
    ctx.lineTo(-4, 17);
    ctx.lineTo(-5, 4);
    ctx.lineTo(-26, 8);
    ctx.lineTo(-26, 2);
    ctx.lineTo(-4, -10);
    ctx.closePath();
  } else if (unitClass === 'airlift') {
    // Wide-body Y-20 strategic transport silhouette
    ctx.moveTo(0, -24);
    ctx.lineTo(4.5, -9);
    ctx.lineTo(25, -2);
    ctx.lineTo(25, 5);
    ctx.lineTo(4.5, 3);
    ctx.lineTo(4, 17);
    ctx.lineTo(13, 22);
    ctx.lineTo(13, 26);
    ctx.lineTo(0, 22);
    ctx.lineTo(-13, 26);
    ctx.lineTo(-13, 22);
    ctx.lineTo(-4, 17);
    ctx.lineTo(-4.5, 3);
    ctx.lineTo(-25, 5);
    ctx.lineTo(-25, -2);
    ctx.lineTo(-4.5, -9);
    ctx.closePath();
  } else if (unitClass === 'awacs') {
    ctx.moveTo(0, -22);
    ctx.lineTo(3.5, -7);
    ctx.lineTo(23, 3);
    ctx.lineTo(23, 8);
    ctx.lineTo(3.5, 5);
    ctx.lineTo(3, 17);
    ctx.lineTo(10, 22);
    ctx.lineTo(10, 25);
    ctx.lineTo(0, 21);
    ctx.lineTo(-10, 25);
    ctx.lineTo(-10, 22);
    ctx.lineTo(-3, 17);
    ctx.lineTo(-3.5, 5);
    ctx.lineTo(-23, 8);
    ctx.lineTo(-23, 3);
    ctx.lineTo(-3.5, -7);
    ctx.closePath();
  } else if (unitClass === 'tanker_isr') {
    // Swept aerial refueling tanker with boom
    ctx.moveTo(0, -24);
    ctx.lineTo(4, -8);
    ctx.lineTo(24, 3);
    ctx.lineTo(24, 8);
    ctx.lineTo(4, 3);
    ctx.lineTo(3.5, 16);
    ctx.lineTo(12, 21);
    ctx.lineTo(12, 25);
    ctx.lineTo(0, 21);
    ctx.lineTo(-12, 25);
    ctx.lineTo(-12, 21);
    ctx.lineTo(-3.5, 16);
    ctx.lineTo(-4, 3);
    ctx.lineTo(-24, 8);
    ctx.lineTo(-24, 3);
    ctx.lineTo(-4, -8);
    ctx.closePath();
  } else if (unitClass === 'electronic_warfare') {
    // Electronic attack swept delta silhouette
    ctx.moveTo(0, -23);
    ctx.lineTo(5, -7);
    ctx.lineTo(21, 5);
    ctx.lineTo(21, 10);
    ctx.lineTo(5, 7);
    ctx.lineTo(4, 17);
    ctx.lineTo(11, 22);
    ctx.lineTo(0, 19);
    ctx.lineTo(-11, 22);
    ctx.lineTo(-4, 17);
    ctx.lineTo(-5, 7);
    ctx.lineTo(-21, 10);
    ctx.lineTo(-21, 5);
    ctx.lineTo(-5, -7);
    ctx.closePath();
  } else if (unitClass === 'uav_swarm') {
    // Stealth flying-wing / long-endurance UAV silhouette
    ctx.moveTo(0, -18);
    ctx.lineTo(24, 6);
    ctx.lineTo(20, 12);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 15);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-20, 12);
    ctx.lineTo(-24, 6);
    ctx.closePath();
  } else {
    // Helicopter
    ctx.moveTo(0, -18);
    ctx.lineTo(4, -8);
    ctx.lineTo(4, 8);
    ctx.lineTo(2, 20);
    ctx.lineTo(7, 23);
    ctx.lineTo(-7, 23);
    ctx.lineTo(-2, 20);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-4, -8);
    ctx.closePath();
  }
}

export function getTacticalIconDataUrl(faction: FactionId, unitClass: UnitClass): string {
  const key = `${faction}:${unitClass}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const color = FACTION_META[faction].colorHex;
  const soft = FACTION_META[faction].softHex;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);

  const isAir =
    unitClass === 'fighter' ||
    unitClass === 'bomber' ||
    unitClass === 'awacs' ||
    unitClass === 'airlift' ||
    unitClass === 'tanker_isr' ||
    unitClass === 'electronic_warfare' ||
    unitClass === 'uav_swarm' ||
    unitClass === 'helicopter';

  if (isAir) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 10;
    drawAircraftPath(ctx, unitClass);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#F8FAFC';
    ctx.stroke();
    ctx.restore();

    if (unitClass === 'awacs') {
      ctx.beginPath();
      ctx.arc(0, 2, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = soft;
      ctx.stroke();
    } else if (unitClass === 'electronic_warfare') {
      // EW wave arcs
      ctx.beginPath();
      ctx.arc(0, -2, 8, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 13, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (unitClass === 'tanker_isr') {
      // Refueling boom indicator
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 29);
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    } else if (unitClass === 'helicopter') {
      ctx.beginPath();
      ctx.moveTo(-19, -12);
      ctx.lineTo(19, 8);
      ctx.moveTo(19, -12);
      ctx.lineTo(-19, 8);
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#F8FAFC';
      ctx.stroke();
    }
  } else {
    const frameR = 26;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    if (faction === 'pla' || faction === 'dprk') {
      ctx.moveTo(0, -frameR - 4);
      ctx.lineTo(frameR + 4, 0);
      ctx.lineTo(0, frameR + 4);
      ctx.lineTo(-frameR - 4, 0);
      ctx.closePath();
    } else if (
      unitClass === 'carrier' ||
      unitClass === 'destroyer' ||
      unitClass === 'amphibious' ||
      unitClass === 'corvette' ||
      unitClass === 'coast_guard' ||
      unitClass === 'mine_warfare' ||
      unitClass === 'submarine'
    ) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(angle) * (frameR + 2);
        const y = Math.sin(angle) * (frameR + 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      const s = frameR - 2;
      const c = 6;
      ctx.moveTo(-s + c, -s);
      ctx.lineTo(s - c, -s);
      ctx.lineTo(s, -s + c);
      ctx.lineTo(s, s - c);
      ctx.lineTo(s - c, s);
      ctx.lineTo(-s + c, s);
      ctx.lineTo(-s, s - c);
      ctx.lineTo(-s, -s + c);
      ctx.closePath();
    }

    ctx.fillStyle = 'rgba(7, 11, 18, 0.90)';
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#F8FAFC';
    ctx.fillStyle = '#F8FAFC';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (unitClass === 'carrier') {
      ctx.beginPath();
      ctx.moveTo(-15, 7);
      ctx.lineTo(15, 7);
      ctx.lineTo(18, 0);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-15, 7);
      ctx.closePath();
      ctx.fillStyle = soft;
      ctx.fill();
      ctx.fillRect(2, -9, 6, 9);
      ctx.fillRect(-10, -3, 14, 3);
    } else if (unitClass === 'destroyer' || unitClass === 'corvette' || unitClass === 'coast_guard') {
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(14, 6);
      ctx.lineTo(17, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fillStyle = soft;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(-3, -10);
      ctx.moveTo(4, 0);
      ctx.lineTo(4, -7);
      ctx.stroke();
      if (unitClass === 'coast_guard') {
        // Diagonal coast-guard hull stripe
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.lineTo(-1, 0);
        ctx.strokeStyle = '#F8FAFC';
        ctx.stroke();
      }
    } else if (unitClass === 'amphibious') {
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(14, 6);
      ctx.lineTo(14, -4);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-14, 6);
      ctx.closePath();
      ctx.fillStyle = soft;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(0, -14);
      ctx.lineTo(9, -9);
      ctx.stroke();
    } else if (unitClass === 'mine_warfare') {
      // Naval mine with detonator horns
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = soft;
      ctx.fill();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
        ctx.lineTo(Math.cos(ang) * 13, Math.sin(ang) * 13);
        ctx.strokeStyle = '#F8FAFC';
        ctx.stroke();
      }
    } else if (unitClass === 'submarine') {
      ctx.beginPath();
      ctx.ellipse(0, 3, 14, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = soft;
      ctx.fill();
      ctx.fillRect(-3, -7, 6, 7);
    } else if (unitClass === 'armor') {
      ctx.beginPath();
      ctx.roundRect(-13, -7, 26, 14, 7);
      ctx.strokeStyle = soft;
      ctx.lineWidth = 2.8;
      ctx.stroke();
    } else if (unitClass === 'airborne') {
      // Airborne parachute wing gull symbol
      ctx.beginPath();
      ctx.moveTo(-13, 3);
      ctx.quadraticCurveTo(-6, -10, 0, -2);
      ctx.quadraticCurveTo(6, -10, 13, 3);
      ctx.strokeStyle = soft;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, 10);
      ctx.stroke();
    } else if (unitClass === 'special_ops') {
      // Special operations spearhead symbol
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(9, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fillStyle = soft;
      ctx.fill();
    } else if (unitClass === 'artillery_mlrs') {
      // Multi-barrel rocket artillery slanted tubes
      ctx.strokeStyle = soft;
      ctx.lineWidth = 2.8;
      for (const ox of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.moveTo(ox - 4, 10);
        ctx.lineTo(ox + 4, -10);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-12, 11);
      ctx.lineTo(12, 11);
      ctx.strokeStyle = '#F8FAFC';
      ctx.stroke();
    } else if (unitClass === 'sam') {
      ctx.beginPath();
      ctx.arc(0, 9, 12, Math.PI, 0);
      ctx.strokeStyle = soft;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, -12);
      ctx.lineTo(-4, -7);
      ctx.moveTo(0, -12);
      ctx.lineTo(4, -7);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    } else if (unitClass === 'coastal_missile' || unitClass === 'rocket_force') {
      ctx.beginPath();
      ctx.moveTo(-5, 11);
      ctx.lineTo(-5, -11);
      ctx.lineTo(-8, -6);
      ctx.moveTo(-5, -11);
      ctx.lineTo(-2, -6);
      ctx.moveTo(5, 11);
      ctx.lineTo(5, -11);
      ctx.lineTo(2, -6);
      ctx.moveTo(5, -11);
      ctx.lineTo(8, -6);
      ctx.strokeStyle = soft;
      ctx.stroke();
    }
  }

  ctx.restore();

  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
