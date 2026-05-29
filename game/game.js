/* Chomiczki — Proof of Concept (Phaser 3.90)
   Menu -> Start -> auto-run (chomik od tylu) + 3 pasy + ziarna/power-up + meta + score. */

const W = 720, H = 1280;
const LANES_X = [160, 360, 560];
const PLAYER_Y = 960;
const SCROLL = 470;           // px/s bazowa predkosc
const FINISH_DIST = 12000;    // ~25 s
const LANE_MS = 220, DEBOUNCE = 160;

const C = {
  cream: 0xfff3df, floor: 0xe9c9a0, floor2: 0xe0bb8d,
  ink: 0x5b4636, peach: 0xff9a52, berry: 0xff7a9c, gold: 0xffc94d,
  mint: 0x8fd9b6, wool: 0xb9a48c, star: 0xffd76b
};

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

// generuje proceduralne tekstury (tlo pasow, ziarno, przeszkoda, gwiazda, przycisk)
function makeTextures(s){
  // tlo pasow 720x256 (kafelkowane pionowo)
  let g = s.make.graphics({x:0,y:0,add:false});
  g.fillStyle(C.floor,1); g.fillRect(0,0,W,256);
  g.fillStyle(C.floor2,1);
  for(let i=0;i<4;i++) g.fillRect(40 + i*200, 0, 6, 256);          // delikatne smugi
  // dywan-tor (jasny pas srodkiem 3 torow) — prosty pas, by kafelkowal bez szwow
  g.fillStyle(C.cream,1);
  g.fillRect(70, 0, W-140, 256);
  // gwiazdki i serduszka na dywanie
  g.fillStyle(C.gold,1);
  star(g, 180, 70, 16); star(g, 540, 180, 14); star(g, 360, 130, 12);
  g.fillStyle(C.berry,1);
  heart(g, 360, 40, 13); heart(g, 200, 210, 12); heart(g, 520, 60, 11);
  // linie pasow
  g.lineStyle(4, 0xeacba0, 1);
  g.lineBetween(260,0,260,256); g.lineBetween(460,0,460,256);
  g.generateTexture('lanebg', W, 256); g.destroy();

  blob(s,'seed', 46, C.gold, 0x9a6b1e);      // ziarno
  blob(s,'obs',  64, C.wool, 0x7c6a55);       // przeszkoda (klebek)
  // gwiazda power-up
  g = s.make.graphics({x:0,y:0,add:false});
  g.fillStyle(C.star,1); star(g, 40, 40, 38);
  g.lineStyle(5,0xc8860a,1); star(g,40,40,38,true);
  g.generateTexture('power', 80, 80); g.destroy();
}
function star(g,cx,cy,r,stroke){
  const pts=[]; for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const rr=i%2?r*0.45:r;
    pts.push(cx+Math.cos(a)*rr); pts.push(cy+Math.sin(a)*rr);}
  if(stroke) g.strokePoints(toPts(pts),true); else g.fillPoints(toPts(pts),true);
}
function toPts(a){const p=[];for(let i=0;i<a.length;i+=2)p.push(new Phaser.Geom.Point(a[i],a[i+1]));return p;}
function heart(g,cx,cy,r){ g.fillCircle(cx-r*0.5,cy-r*0.3,r*0.55); g.fillCircle(cx+r*0.5,cy-r*0.3,r*0.55);
  g.fillTriangle(cx-r,cy-r*0.1,cx+r,cy-r*0.1,cx,cy+r); }
function blob(s,key,d,fill,line){
  const g=s.make.graphics({x:0,y:0,add:false});
  g.fillStyle(line,1); g.fillCircle(d/2,d/2,d/2);
  g.fillStyle(fill,1); g.fillCircle(d/2,d/2,d/2-4);
  g.generateTexture(key,d,d); g.destroy();
}

// ---------------------------------------------------------------- MENU
class Menu extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    this.add.rectangle(0,0,W,H,C.cream).setOrigin(0);
    this.add.tileSprite(W/2, H-200, W, 520, 'lanebg').setAlpha(0.5);
    const ham = this.add.sprite(W/2, 430, 'run', 0).setScale(1.25).play('bieg');
    this.tweens.add({targets:ham, y:'+=16', duration:520, yoyo:true, repeat:-1, ease:'Sine.inOut'});
    this.add.text(W/2, 150, 'CHOMICZKI', {fontFamily:'"Baloo 2", Quicksand, sans-serif', fontSize:'120px',
      color:'#ff8a3c', stroke:'#ffffff', strokeThickness:12}).setOrigin(0.5);
    this.add.text(W/2, 250, 'biegnij • omijaj • zbieraj ziarna', {fontFamily:'Quicksand, sans-serif',
      fontSize:'34px', color:'#8a7461'}).setOrigin(0.5);
    // przycisk START
    const bw=360, bh=130, bx=W/2, by=720;
    const btn = this.add.container(bx, by);
    const bg = this.add.rectangle(0,0,bw,bh,0xff8a3c).setStrokeStyle(0,0).setOrigin(0.5);
    bg.setInteractive({useHandCursor:true});
    const sh = this.add.rectangle(0,12,bw,bh,0xe07e36).setOrigin(0.5);
    btn.add([sh, bg]);
    btn.add(this.add.text(0,-4,'START',{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'70px',
      color:'#ffffff'}).setOrigin(0.5));
    this.tweens.add({targets:btn, scale:1.06, duration:700, yoyo:true, repeat:-1, ease:'Sine.inOut'});
    this.add.text(W/2, 900, 'dotknij lewej • środka • prawej części ekranu',
      {fontFamily:'Quicksand, sans-serif', fontSize:'30px', color:'#a08866'}).setOrigin(0.5);
    const go = ()=> this.scene.start('Race');
    bg.on('pointerdown', go);
    if(this.input.keyboard){ this.input.keyboard.once('keydown-SPACE', go);
      this.events.once('shutdown', ()=> this.input.keyboard.removeAllListeners('keydown-SPACE')); }
  }
}

// ---------------------------------------------------------------- RACE
class Race extends Phaser.Scene {
  constructor(){ super('Race'); }
  create(){
    this.lane=1; this.dist=0; this.score=0; this.stumbles=0;
    this.lastSwitch=0; this.spawnAcc=0; this.spawnEvery=560; this.finished=false;
    this.stumbleUntil=0; this.boostUntil=0; this.invulnUntil=0;

    this.bg = this.add.tileSprite(W/2, H/2, W, H, 'lanebg');
    this.items = this.add.group();

    this.player = this.add.sprite(LANES_X[1], PLAYER_Y, 'run').play('bieg').setDepth(10);

    // HUD
    this.add.rectangle(0,0,W,90,0x000000,0.12).setOrigin(0);
    this.add.image(46,46,'seed').setScale(0.9);
    this.scoreTxt = this.add.text(78, 22, '0', {fontFamily:'"Baloo 2", Quicksand, sans-serif', fontSize:'52px',
      color:'#5b4636'}).setDepth(20);
    this.barBg = this.add.rectangle(W/2, 80, W-220, 16, 0xffffff, 0.6).setDepth(20);
    this.bar   = this.add.rectangle(W/2-(W-220)/2, 80, 0, 16, 0x8fd9b6).setOrigin(0,0.5).setDepth(20);
    this.add.text(W-150, 18, '🏁', {fontSize:'46px'}).setDepth(20);

    this.input.on('pointerdown', p => this.switchLane(p.x));
    if(this.input.keyboard){
      this.input.keyboard.on('keydown-LEFT',  ()=>this.toLane(this.lane-1));
      this.input.keyboard.on('keydown-RIGHT', ()=>this.toLane(this.lane+1));
      this.events.once('shutdown', ()=>{ this.input.keyboard.removeAllListeners('keydown-LEFT');
        this.input.keyboard.removeAllListeners('keydown-RIGHT'); });
    }
  }

  switchLane(px){ this.toLane(Phaser.Math.Clamp(Math.floor(3*px/this.scale.width),0,2)); }
  toLane(z){
    z=Phaser.Math.Clamp(z,0,2);
    const now=this.time.now;
    if(now-this.lastSwitch<DEBOUNCE || z===this.lane || this.finished) return;
    const dir = z<this.lane ? 1 : 2;       // 1=lewo 2=prawo (klatki lane)
    this.lane=z; this.lastSwitch=now;
    this.player.setTexture('lane', dir);
    this.tweens.add({targets:this.player, x:LANES_X[z], duration:LANE_MS, ease:'Sine.easeOut',
      onComplete:()=>{ if(!this.finished) this.player.play('bieg'); }});
  }

  eff(){
    const t=this.time.now;
    if(t<this.stumbleUntil) return 0.45;
    if(t<this.boostUntil)   return 1.6;
    return 1;
  }

  spawn(){
    const lane = Phaser.Math.Between(0,2);
    const r = Math.random();
    let type='seed';
    if(r<0.30) type='obs';
    else if(r>0.92) type='power';
    // gwarancja wolnego pasa: nie stawiaj przeszkody jesli inna przeszkoda jest blisko w innym pasie
    if(type==='obs'){
      let blocked=0;
      this.items.getChildren().forEach(o=>{ if(o.active && o.getData('type')==='obs' && o.y<260) blocked++; });
      if(blocked>=1) type='seed';
    }
    const key = type==='obs'?'obs':(type==='power'?'power':'seed');
    let o=this.items.getFirstDead(false);
    if(o){ o.setTexture(key).setActive(true).setVisible(true); }
    else { o=this.add.image(0,0,key); this.items.add(o); }
    o.setPosition(LANES_X[lane], -60).setData({type, lane}).setDepth(5)
     .setScale(type==='power'?1:(type==='obs'?1.15:1));
  }

  update(time, delta){
    if(this.finished) return;
    const dt=delta/1000, e=this.eff();
    const v=SCROLL*e;
    this.bg.tilePositionY -= v*dt;
    this.dist += v*dt;

    // spawn
    this.spawnAcc += delta;
    if(this.spawnAcc>=this.spawnEvery){ this.spawnAcc=0; this.spawn();
      this.spawnEvery=Math.max(300, this.spawnEvery-6); }

    // ruch + kolizje
    const inv = time<this.invulnUntil;
    this.items.getChildren().forEach(o=>{
      if(!o.active) return;
      o.y += v*dt;
      if(o.y>H+80){ this.items.killAndHide(o); return; }
      const t=o.getData('type');
      if(o.getData('lane')===this.lane && Math.abs(o.y-PLAYER_Y)<78){
        if(t==='seed'){ this.collect(o); }
        else if(t==='power'){ this.powerup(o); }
        else if(t==='obs' && !inv){ this.hit(o); }
      }
    });

    // progres
    const p=Phaser.Math.Clamp(this.dist/FINISH_DIST,0,1);
    this.bar.width=(W-220)*p;
    if(this.dist>=FINISH_DIST) this.win();
  }

  collect(o){ this.items.killAndHide(o); this.score++; this.scoreTxt.setText(''+this.score);
    this.boostUntil=this.time.now+260; this.pop(o.x,o.y,'#ffc94d','+'); }
  powerup(o){ this.items.killAndHide(o); this.boostUntil=this.time.now+3000;
    this.invulnUntil=this.time.now+3000; this.player.setTint(0xffe08a);
    this.time.delayedCall(3000,()=>{ if(this.player&&this.player.active) this.player.clearTint(); });
    this.pop(o.x,o.y,'#ffd76b','★'); }
  hit(o){ this.items.killAndHide(o); this.stumbles++;
    this.stumbleUntil=this.time.now+1300; this.invulnUntil=this.time.now+1100;
    this.player.setTint(0xff8a8a); this.cameras.main.shake(180,0.012);
    this.time.delayedCall(900,()=>{ if(this.player&&this.player.active) this.player.clearTint(); });
    this.pop(o.x,o.y-20,'#ff7a7a','oj!'); }
  pop(x,y,col,txt){
    const t=this.add.text(x,y,txt,{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'52px',color:col,
      stroke:'#ffffff',strokeThickness:6}).setOrigin(0.5).setDepth(30);
    this.tweens.add({targets:t,y:y-90,alpha:0,duration:700,onComplete:()=>t.destroy()}); }

  win(){
    this.finished=true; this.player.play('bieg');
    const banner=this.add.text(W/2, H/2, '🏁 META! 🏁',{fontFamily:'"Baloo 2", Quicksand, sans-serif',
      fontSize:'90px',color:'#2e8b57',stroke:'#ffffff',strokeThickness:10}).setOrigin(0.5).setDepth(40);
    this.tweens.add({targets:banner,scale:1.15,duration:400,yoyo:true,repeat:1});
    this.time.delayedCall(1100,()=> this.scene.start('Result',
      {score:this.score, stumbles:this.stumbles}));
  }
}

// ---------------------------------------------------------------- RESULT
class Result extends Phaser.Scene {
  constructor(){ super('Result'); }
  create(d){
    let stars=1; if(d.score>=8) stars++; if(d.stumbles<=2) stars++;
    this.add.rectangle(0,0,W,H,C.cream).setOrigin(0);
    this.add.text(W/2,200,'BRAWO!',{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'120px',
      color:'#ff8a3c',stroke:'#ffffff',strokeThickness:12}).setOrigin(0.5);
    // gwiazdki
    for(let i=0;i<3;i++){
      const on=i<stars;
      this.add.text(W/2-180+i*180, 420, '★',{fontSize:'150px',
        color: on?'#ffd24d':'#e6d6bf'}).setOrigin(0.5);
    }
    this.add.image(W/2-60, 640,'seed').setScale(1.3);
    this.add.text(W/2-20, 612, '× '+d.score, {fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'64px',
      color:'#5b4636'}).setOrigin(0,0.5);
    const by=900, bw=420, bh=130;
    const sh=this.add.rectangle(W/2,by+12,bw,bh,0xe07e36);
    const bg=this.add.rectangle(W/2,by,bw,bh,0xff8a3c).setInteractive({useHandCursor:true});
    this.add.text(W/2,by-4,'JESZCZE RAZ',{fontFamily:'"Baloo 2", Quicksand, sans-serif',fontSize:'56px',
      color:'#ffffff'}).setOrigin(0.5);
    const again=()=>this.scene.start('Race');
    bg.on('pointerdown', again);
    this.input.keyboard.on('keydown-SPACE', again);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#fff3df',
  parent: 'game',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Menu, Race, Result]
});
