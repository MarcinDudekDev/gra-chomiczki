/* Chomiczki — PoC (Phaser 3.90), widok PSEUDO-3D w stylu Hugo.
   Menu -> Start -> chomik od tylu biegnie W GLAB, sciezka ucieka do horyzontu,
   przeszkody/ziarna nadlatuja od punktu zbiegu i rosna; 3 pasy; meta; score. */

const W = 720, H = 1280;
const HORIZON = 380;          // linia horyzontu (punkt zbiegu)
const ROAD_FAR = 24;          // pol-szerokosc drogi przy horyzoncie
const ROAD_NEAR = 330;        // pol-szerokosc drogi na dole
const LANE_F = 0.60;          // rozstaw pasow (czesc pol-szerokosci drogi)
const PLAYER_D = 0.88;        // glebokosc gracza (0=horyzont,1=kamera)
const SCROLL = 0.46;          // tempo zblizania (d/s) — wrazenie predkosci
const FINISH_T = 26;          // sekundy do mety
const LANE_MS = 180, DEBOUNCE = 150;

const C = { cream:0xfff3df, road:0xf3e0c2, road2:0xe7cda3, wall:0xd7b488,
  wall2:0xc59c6f, ink:0x5b4636, gold:0xffc94d, wool:0xb9a48c, star:0xffd76b, berry:0xff7a9c };

// ---- projekcja perspektywiczna ----
function projY(d){ return HORIZON + (H - HORIZON) * Math.pow(d, 1.8); }
function projScale(d){ return 0.08 + 1.05 * Math.pow(d, 1.5); }
function roadHalf(d){ return ROAD_FAR + (ROAD_NEAR - ROAD_FAR) * Math.pow(d, 1.15); }
function laneX(lane, d){ return W/2 + (lane - 1) * roadHalf(d) * LANE_F; }

// ---------------------------------------------------------------- BOOT
class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    this.load.spritesheet('run',  'assets/chomik_run.png',  { frameWidth:256, frameHeight:256 });
    this.load.spritesheet('lane', 'assets/chomik_lane.png', { frameWidth:256, frameHeight:256 });
  }
  create(){
    this.anims.create({ key:'bieg',
      frames:this.anims.generateFrameNumbers('run',{start:0,end:5}), frameRate:14, repeat:-1 });
    makeTextures(this);
    this.scene.start('Menu');
  }
}

function makeTextures(s){
  blob(s,'seed', 64, C.gold, 0x9a6b1e);
  blob(s,'obs',  72, C.wool, 0x7c6a55);
  let g = s.make.graphics({x:0,y:0,add:false});
  g.fillStyle(C.star,1); star(g,40,42,38);
  g.lineStyle(5,0xc8860a,1); star(g,40,42,38,true);
  g.generateTexture('power',80,84); g.destroy();
}
function star(g,cx,cy,r,stroke){
  const a=[]; for(let i=0;i<10;i++){const t=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;
    a.push(new Phaser.Geom.Point(cx+Math.cos(t)*rr, cy+Math.sin(t)*rr));}
  if(stroke) g.strokePoints(a,true); else g.fillPoints(a,true);
}
function blob(s,key,d,fill,line){
  const g=s.make.graphics({x:0,y:0,add:false});
  g.fillStyle(line,1); g.fillCircle(d/2,d/2,d/2);
  g.fillStyle(fill,1); g.fillCircle(d/2,d/2,d/2-4);
  g.fillStyle(0xffffff,0.25); g.fillCircle(d*0.38,d*0.36,d*0.16);
  g.generateTexture(key,d,d); g.destroy();
}

// ---------------------------------------------------------------- MENU
class Menu extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    this.add.rectangle(0,0,W,H,C.cream).setOrigin(0);
    drawRoad(this.add.graphics(), 0);                       // statyczna droga w tle menu
    const ham = this.add.sprite(W/2, 760, 'run', 0).setScale(1.5).play('bieg');
    this.tweens.add({targets:ham, y:'+=16', duration:520, yoyo:true, repeat:-1, ease:'Sine.inOut'});
    this.add.text(W/2, 150, 'CHOMICZKI', {fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'120px', color:'#ff8a3c', stroke:'#ffffff', strokeThickness:12}).setOrigin(0.5);
    this.add.text(W/2, 250, 'biegnij • omijaj • zbieraj ziarna',
      {fontFamily:'Quicksand, sans-serif', fontSize:'34px', color:'#8a7461'}).setOrigin(0.5);
    const by=1010, bw=380, bh=130;
    this.add.rectangle(W/2,by+12,bw,bh,0xe07e36);
    const bg=this.add.rectangle(W/2,by,bw,bh,0xff8a3c).setInteractive({useHandCursor:true});
    this.add.text(W/2,by-4,'START',{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'70px',
      color:'#ffffff'}).setOrigin(0.5);
    this.tweens.add({targets:bg, scaleX:1.05, scaleY:1.05, duration:700, yoyo:true, repeat:-1});
    const go=()=>this.scene.start('Race');
    bg.on('pointerdown', go);
    if(this.input.keyboard){ this.input.keyboard.once('keydown-SPACE', go);
      this.events.once('shutdown',()=>this.input.keyboard.removeAllListeners('keydown-SPACE')); }
  }
}

// rysuje perspektywiczna droge w Graphics g, z faza scrollu (0..1) na poprzeczki
function drawRoad(g, phase){
  g.clear();
  g.fillStyle(C.wall,1);  g.fillRect(0,0,W,HORIZON);          // sciana w tle
  g.fillStyle(C.wall2,1); g.fillRect(0,HORIZON-6,W,6);
  g.fillStyle(C.road2,1); g.fillRect(0,HORIZON,W,H-HORIZON);  // baza podlogi
  // trapez drogi
  g.fillStyle(C.road,1);
  g.fillPoints([
    new Phaser.Geom.Point(W/2-roadHalf(0),HORIZON),
    new Phaser.Geom.Point(W/2+roadHalf(0),HORIZON),
    new Phaser.Geom.Point(W/2+roadHalf(1),H),
    new Phaser.Geom.Point(W/2-roadHalf(1),H)
  ], true);
  // poprzeczki (wrazenie pedu)
  g.fillStyle(C.road2,0.55);
  for(let i=0;i<14;i++){
    const d=((i/14)+phase)%1;
    const y=projY(d), h=Math.max(2, 26*Math.pow(d,1.7)), hw=roadHalf(d);
    g.fillRect(W/2-hw, y, hw*2, h);
  }
  // linie pasow (granice)
  g.lineStyle(4,0xe6cba0,0.9);
  for(const b of [-0.30,0.30]){
    g.lineBetween(W/2+b*roadHalf(0)*2, HORIZON, W/2+b*roadHalf(1)*2, H);
  }
  // krawedzie drogi
  g.lineStyle(6,0xdcbd96,1);
  g.lineBetween(W/2-roadHalf(0),HORIZON, W/2-roadHalf(1),H);
  g.lineBetween(W/2+roadHalf(0),HORIZON, W/2+roadHalf(1),H);
}

// ---------------------------------------------------------------- RACE
class Race extends Phaser.Scene {
  constructor(){ super('Race'); }
  create(){
    this.lane=1; this.t=0; this.score=0; this.stumbles=0;
    this.lastSwitch=0; this.spawnAcc=0; this.spawnEvery=620; this.phase=0; this.finished=false;
    this.stumbleUntil=0; this.boostUntil=0; this.invulnUntil=0;

    this.road = this.add.graphics().setDepth(0);
    this.items = this.add.group();
    this.player = this.add.sprite(laneX(1,PLAYER_D), projY(PLAYER_D), 'run')
      .setScale(projScale(PLAYER_D)*0.8).play('bieg').setDepth(950);

    // HUD
    this.add.rectangle(0,0,W,92,0x000000,0.14).setOrigin(0).setDepth(1000);
    this.add.image(48,46,'seed').setScale(0.7).setDepth(1001);
    this.scoreTxt=this.add.text(82,20,'0',{fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'52px',color:'#fff8ec',stroke:'#5b4636',strokeThickness:6}).setDepth(1001);
    this.barBg=this.add.rectangle(W/2,82,W-230,16,0xffffff,0.55).setDepth(1001);
    this.bar=this.add.rectangle(W/2-(W-230)/2,82,0,16,0x8fd9b6).setOrigin(0,0.5).setDepth(1001);
    this.add.text(W-150,16,'🏁',{fontSize:'48px'}).setDepth(1001);

    this.input.on('pointerdown', p => this.toLane(Math.floor(3*p.x/this.scale.width)));
    if(this.input.keyboard){
      this.input.keyboard.on('keydown-LEFT', ()=>this.toLane(this.lane-1));
      this.input.keyboard.on('keydown-RIGHT',()=>this.toLane(this.lane+1));
      this.events.once('shutdown',()=>{ this.input.keyboard.removeAllListeners('keydown-LEFT');
        this.input.keyboard.removeAllListeners('keydown-RIGHT'); });
    }
  }

  toLane(z){
    z=Phaser.Math.Clamp(z,0,2);
    const now=this.time.now;
    if(now-this.lastSwitch<DEBOUNCE || z===this.lane || this.finished) return;
    this.lane=z; this.lastSwitch=now;
    this.tweens.add({targets:this.player, x:laneX(z,PLAYER_D), duration:LANE_MS, ease:'Sine.easeOut'});
  }

  eff(){ const t=this.time.now;
    if(t<this.stumbleUntil) return 0.45;
    if(t<this.boostUntil)   return 1.55; return 1; }

  spawn(){
    const lane=Phaser.Math.Between(0,2), r=Math.random();
    let type = r<0.30 ? 'obs' : (r>0.92 ? 'power' : 'seed');
    if(type==='obs'){ let near=0;
      this.items.getChildren().forEach(o=>{ if(o.active && o.getData('type')==='obs' && o.getData('d')<0.22) near++; });
      if(near>=1) type='seed';
    }
    const key = type==='obs'?'obs':(type==='power'?'power':'seed');
    let o=this.items.getFirstDead(false);
    if(o) o.setTexture(key).setActive(true).setVisible(true);
    else { o=this.add.image(0,0,key); this.items.add(o); }
    o.setData({type, lane, d:0.001, base:(type==='obs'?1.15:(type==='power'?1.0:0.9))});
  }

  update(time, delta){
    if(this.finished) return;
    const dt=delta/1000, e=this.eff(), v=SCROLL*e;
    this.phase=(this.phase + v*dt)%1;
    drawRoad(this.road, this.phase);
    this.t += dt*e;

    this.spawnAcc+=delta;
    if(this.spawnAcc>=this.spawnEvery){ this.spawnAcc=0; this.spawn();
      this.spawnEvery=Math.max(360, this.spawnEvery-7); }

    const inv = time<this.invulnUntil;
    this.items.getChildren().slice().forEach(o=>{
      if(!o.active) return;
      const prev=o.getData('d'), d=prev + v*dt; o.setData('d', d);
      if(d>1.06){ this.items.killAndHide(o); return; }
      o.setPosition(laneX(o.getData('lane'), d), projY(d))
       .setScale(projScale(d)*o.getData('base')).setDepth(Math.floor(d*900));
      // test przeciecia plaszczyzny gracza (odporny na tunneling przy lagu)
      if(prev<PLAYER_D && d>=PLAYER_D && o.getData('lane')===this.lane){
        const t=o.getData('type');
        if(t==='seed') this.collect(o);
        else if(t==='power') this.powerup(o);
        else if(t==='obs' && !inv) this.hit(o);
      }
    });

    const p=Phaser.Math.Clamp(this.t/FINISH_T,0,1);
    this.bar.width=(W-230)*p;
    if(this.t>=FINISH_T) this.win();
  }

  collect(o){ this.items.killAndHide(o); this.score++; this.scoreTxt.setText(''+this.score);
    this.boostUntil=this.time.now+240; this.pop(this.player.x,this.player.y-150,'#ffc94d','+'); }
  powerup(o){ this.items.killAndHide(o); this.boostUntil=this.time.now+3000;
    this.invulnUntil=this.time.now+3000; this.player.setTint(0xffe08a);
    this.time.delayedCall(3000,()=>{ if(this.player&&this.player.active) this.player.clearTint(); });
    this.pop(this.player.x,this.player.y-150,'#ffd76b','★'); }
  hit(o){ this.items.killAndHide(o); this.stumbles++;
    this.stumbleUntil=this.time.now+1300; this.invulnUntil=this.time.now+1100;
    this.player.setTint(0xff8a8a); this.cameras.main.shake(170,0.012);
    this.time.delayedCall(900,()=>{ if(this.player&&this.player.active) this.player.clearTint(); });
    this.pop(this.player.x,this.player.y-150,'#ff7a7a','oj!'); }
  pop(x,y,col,txt){
    const t=this.add.text(x,y,txt,{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'60px',
      color:col,stroke:'#ffffff',strokeThickness:7}).setOrigin(0.5).setDepth(1100);
    this.tweens.add({targets:t,y:y-90,alpha:0,duration:700,onComplete:()=>t.destroy()}); }

  win(){
    this.finished=true;
    const b=this.add.text(W/2,H/2,'🏁 META! 🏁',{fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'88px',color:'#2e8b57',stroke:'#ffffff',strokeThickness:10}).setOrigin(0.5).setDepth(1200);
    this.tweens.add({targets:b,scale:1.15,duration:400,yoyo:true,repeat:1});
    this.time.delayedCall(1100,()=>this.scene.start('Result',{score:this.score,stumbles:this.stumbles}));
  }
}

// ---------------------------------------------------------------- RESULT
class Result extends Phaser.Scene {
  constructor(){ super('Result'); }
  create(d){
    let stars=1; if(d.score>=8) stars++; if(d.stumbles<=2) stars++;
    this.add.rectangle(0,0,W,H,C.cream).setOrigin(0);
    this.add.text(W/2,210,'BRAWO!',{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'120px',
      color:'#ff8a3c',stroke:'#ffffff',strokeThickness:12}).setOrigin(0.5);
    for(let i=0;i<3;i++) this.add.text(W/2-180+i*180,430,'★',
      {fontSize:'150px',color:i<stars?'#ffd24d':'#e6d6bf'}).setOrigin(0.5);
    this.add.image(W/2-70,650,'seed').setScale(0.95);
    this.add.text(W/2-30,622,'× '+d.score,{fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'64px',color:'#5b4636'}).setOrigin(0,0.5);
    const by=920,bw=440,bh=130;
    this.add.rectangle(W/2,by+12,bw,bh,0xe07e36);
    const bg=this.add.rectangle(W/2,by,bw,bh,0xff8a3c).setInteractive({useHandCursor:true});
    this.add.text(W/2,by-4,'JESZCZE RAZ',{fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'56px',color:'#ffffff'}).setOrigin(0.5);
    const again=()=>this.scene.start('Race');
    bg.on('pointerdown', again);
    if(this.input.keyboard){ this.input.keyboard.once('keydown-SPACE', again);
      this.events.once('shutdown',()=>this.input.keyboard.removeAllListeners('keydown-SPACE')); }
  }
}

new Phaser.Game({
  type: Phaser.AUTO, width:W, height:H, backgroundColor:'#fff3df', parent:'game',
  scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH },
  scene:[Boot, Menu, Race, Result]
});
