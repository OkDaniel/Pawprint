import { MAX_FLOOR_PLACEMENTS, MOCHI_RESERVED_REGION, FLOOR_GRID_SUBDIVISIONS } from '@capstone/shared';
import { useState, type MouseEvent } from 'react';
import { useAuth } from '../../auth/useAuth';
import room5 from '../../assets/room/room5.png';
import { resolveCatAnimation, DEFAULT_CAT_APPEARANCE } from '../home/catCatalog';
import { decorations, families } from './catalog';
import { anchorPosition, CAT_BASE, CAT_CENTER, depthOrder, fitsArt, floorPoint, inside, MAX_ITEMS, occupiedCells, placementError, REVIEW_STATES, reviewLayout, snapFloor, spriteOrigin, WALLS, type GridSize, type PlacedItem, type Point, type ReviewState, type Wall } from './placement';
import styles from './BuildPreviewPage.module.css';

const points = (values: Point[]) => values.map(p=>p.join(',')).join(' ');
const getItem = (p: PlacedItem) => decorations.find(d=>d.id===p.itemId)!;
const wallCenter = (wall: Wall): Point => wall==='left' ? [139,183] : [376,183];

export default function BuildPreviewPage() {
  const { user } = useAuth();
  const [grid,setGrid] = useState<GridSize>(12);
  const [productionRules,setProductionRules] = useState(false);
  const [showGrid,setShowGrid] = useState(true);
  const [debug,setDebug] = useState(true);
  const [placed,setPlaced] = useState<PlacedItem[]>([]);
  const [selected,setSelected] = useState<number|null>(null);
  const [itemId,setItemId] = useState('decor_cat_bed_cushioned_blue');
  const [scale,setScale] = useState(1);
  const [wall,setWall] = useState<Wall>('left');
  const [wallPreview,setWallPreview] = useState(false);
  const [message,setMessage] = useState('');
  const [nodeU,setNodeU] = useState(8);
  const [nodeV,setNodeV] = useState(8);
  const [verdicts,setVerdicts] = useState<Record<string,string>>({});
  const item = decorations.find(d=>d.id===itemId)!;
  const active = placed.find(p=>p.key===selected);
  const ghost: PlacedItem = {key:-1,itemId,scale,u:0,v:0,wall,position:wallCenter(wall)};
  const cat = resolveCatAnimation(user?.catAppearance ?? DEFAULT_CAT_APPEARANCE,'idle');
  const cap = productionRules ? MAX_FLOOR_PLACEMENTS : MAX_ITEMS;
  const checkPlacement: typeof placementError = (p,d,existing,items,nextGrid) => placementError(p,d,existing,items,nextGrid,productionRules);
  const sorted = [...placed.filter(p=>!p.wall).map(p=>({key:p.key,depth:anchorPosition(p,grid)[1],p})),{key:0,depth:CAT_BASE[1],p:null}].sort(depthOrder);
  function select(p: PlacedItem) {
    setSelected(p.key); setItemId(p.itemId); setScale(p.scale);
    if (p.wall) setWall(p.wall);
  }

  function changeGrid(next: GridSize) {
    // Reject a switch that would silently invalidate existing bases; review presets reset first.
    const bad = placed.find(p=>checkPlacement(p,getItem(p),placed,decorations,next));
    if (bad) { setMessage('Existing footprints conflict at that density. Clear the room or load its review preset first.'); return; }
    setGrid(next); setMessage('');
  }
  function commitAt(point: Point) {
    const moving = active;
    const d = moving ? getItem(moving) : item;
    const candidate: PlacedItem = moving ? {...moving} : {key:Math.max(0,...placed.map(p=>p.key))+1,itemId,scale,u:0,v:0,wall:null,position:[0,0]};
    if (d.placement==='wall') {
      candidate.wall = wall;
      candidate.position = point;
      if (!inside(point,WALLS[wall])) { setMessage('Choose a location on the selected wall.'); return; }
    } else {
      [candidate.u,candidate.v] = snapFloor(point,grid);
      candidate.wall = null;
    }
    const error = checkPlacement(candidate,d,placed,decorations,grid);
    if (error) { setMessage(error); return; }
    if (!moving && placed.length>=cap) { setMessage(`Object cap: ${cap}. Remove one first.`); return; }
    setPlaced([...placed.filter(p=>p.key!==candidate.key),candidate]);
    setSelected(candidate.key); setMessage('');
  }
  function sceneClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    commitAt([(event.clientX-rect.left)*512/rect.width,(event.clientY-rect.top)*512/rect.height]);
  }
  function review(state: ReviewState) {
    const nextGrid = state==='Sparse 16' ? 16 : state==='Sparse 12' ? 12 : grid;
    setGrid(nextGrid); setPlaced(reviewLayout(state,decorations,nextGrid).filter(p=>!productionRules || !placementError(p,getItem(p),[],decorations,nextGrid,true)).slice(0,productionRules?MAX_FLOOR_PLACEMENTS:MAX_ITEMS)); setSelected(null); setMessage(''); setScale(1);
    setWallPreview(state==='Left wall'||state==='Right wall');
    if (state.includes('wall')) { setItemId('room_decor_001_v01'); setWall(state==='Left wall'?'left':'right'); }
  }
  function drawItem(p: PlacedItem, preview = false) {
    const d = getItem(p), [x,y] = spriteOrigin(p,d,grid), a = anchorPosition(p,grid);
    return <g key={p.key} data-placed-key={p.key} data-depth={a[1]} onClick={preview?undefined:(event)=>{event.stopPropagation();select(p);setMessage('Selected. Click a new location to move, or use Remove selected.');}}>
      <image href={d.src} x={x} y={y} width={d.width*p.scale} height={d.height*p.scale} opacity={preview ? .8 : 1} />
      {debug && (selected===p.key || preview) && <g pointerEvents="none">
        <rect x={x} y={y} width={d.width*p.scale} height={d.height*p.scale} fill="none" stroke="#b13939" strokeWidth="1" />
        <circle cx={a[0]} cy={a[1]} r="3" fill="#b13939" />
        {occupiedCells(p,d,grid).map(([u,v])=><polygon key={`${u},${v}`} points={points([floorPoint(u/grid,v/grid),floorPoint((u+1)/grid,v/grid),floorPoint((u+1)/grid,(v+1)/grid),floorPoint(u/grid,(v+1)/grid)])} fill="#eab24b" fillOpacity=".3" stroke="#8c5900" strokeWidth=".5" />)}
      </g>}
    </g>;
  }
  return <main className={styles.page!}>
    <h1>Development placement sandbox</h1>
    <p>512×512 logical Room5 · local review only · refresh resets everything · no Store or persistence</p>
    <p className={styles.note!}>Choose an item, then click the room. Select an object to move it; New placement exits move mode. The list also supports keyboard selection and arrow-key moves. Mochi uses a static idle frame for repeatable depth checks.</p>
    <div className={styles.layout!}>
      <div>
        <svg className={styles.scene!} viewBox="0 0 512 512" aria-label="Room5 placement laboratory" onClick={sceneClick}>
          <image href={room5} width="512" height="512" />
          {showGrid && <g pointerEvents="none" stroke="#536d49" strokeOpacity=".5" strokeWidth=".5">
            {Array.from({length:grid+1},(_,i)=><g key={i}>
              <line x1={floorPoint(i/grid,0)[0]} y1={floorPoint(i/grid,0)[1]} x2={floorPoint(i/grid,1)[0]} y2={floorPoint(i/grid,1)[1]} />
              <line x1={floorPoint(0,i/grid)[0]} y1={floorPoint(0,i/grid)[1]} x2={floorPoint(1,i/grid)[0]} y2={floorPoint(1,i/grid)[1]} />
            </g>)}
          </g>}
          {showGrid && productionRules && <polygon pointerEvents="none" fill="#a47bb0" fillOpacity=".22" points={points([
            floorPoint(MOCHI_RESERVED_REGION.minU/FLOOR_GRID_SUBDIVISIONS,MOCHI_RESERVED_REGION.minV/FLOOR_GRID_SUBDIVISIONS),
            floorPoint((MOCHI_RESERVED_REGION.maxU+1)/FLOOR_GRID_SUBDIVISIONS,MOCHI_RESERVED_REGION.minV/FLOOR_GRID_SUBDIVISIONS),
            floorPoint((MOCHI_RESERVED_REGION.maxU+1)/FLOOR_GRID_SUBDIVISIONS,(MOCHI_RESERVED_REGION.maxV+1)/FLOOR_GRID_SUBDIVISIONS),
            floorPoint(MOCHI_RESERVED_REGION.minU/FLOOR_GRID_SUBDIVISIONS,(MOCHI_RESERVED_REGION.maxV+1)/FLOOR_GRID_SUBDIVISIONS),
          ])} />}
          {placed.filter(p=>p.wall).map(p=>drawItem(p))}
          {item.placement==='wall' && wallPreview && drawItem(ghost,true)}
          {sorted.map(entry=>entry.p ? drawItem(entry.p) : <g key="cat" role="img" aria-label={`${cat.appearance.displayName} at Home position`} data-depth={CAT_BASE[1]} data-cat-depth>
            <svg x={CAT_CENTER[0]-48} y={CAT_CENTER[1]-48} width="96" height="96" viewBox="0 0 32 32" overflow="hidden" pointerEvents="none"><image href={cat.animation.src} width={cat.animation.frameCount*32} height="32" /></svg>
            {debug && <circle cx={CAT_BASE[0]} cy={CAT_BASE[1]} r="3" fill="#1856a0" pointerEvents="none" />}
          </g>)}
        </svg>
        <p className={styles.note!}>Red = selected bounds/base anchor. Gold = occupied floor cells. Blue = Mochi base. Native 16×16 floor footprints, anchors and family artwork envelopes use the production contract. Tall artwork may rise above the floor. Development experiments allow Mochi overlap for depth review.</p>
        <p role="status" className={styles.message!}>{message}</p>
      </div>
      <section className={styles.panel!} aria-label="Development controls">
        <label className={styles.check!}><input type="checkbox" checked={productionRules} onChange={e=>{
          const enabled=e.target.checked;
          setProductionRules(enabled); setPlaced([]); setSelected(null); setMessage('');
          if(enabled) {setGrid(FLOOR_GRID_SUBDIVISIONS);setScale(1);setItemId('decor_cat_bed_cushioned_blue');setWallPreview(false);}
        }} />Enforce production floor contract</label>
        <p className={styles.note!}>{productionRules?'PRODUCTION CONTRACT: 16×16, native 1×, 20 floor items, reserved Mochi cells.':'DEVELOPMENT EXPERIMENTS: optional 12×12 / 2× / walls; Mochi overlap allowed for depth checks.'}</p>
        <label>Item family<select value={item.familyId} onChange={e=>{setItemId(families.find(d=>d.familyId===e.target.value)!.id);setSelected(null);setMessage('');}}>{families.filter(d=>!productionRules||d.placement==='floor').map(d=><option key={d.familyId} value={d.familyId}>{d.familyId.slice(-3)} · {d.name}</option>)}</select></label>
        <label>Visual variant<select value={itemId} onChange={e=>{setItemId(e.target.value);setSelected(null);}}>{decorations.filter(d=>d.familyId===item.familyId).map(d=><option key={d.id}>{d.id}</option>)}</select></label>
        <p className={styles.note!}>Native {item.width}×{item.height}px · {item.placement} · {item.familyId==='room_decor_019'?'kibble baseline; six colors':item.familyId==='room_decor_003'?'larger yarn set; small set inactive':item.production?'approved semantic identity':'development wall identity'}</p>
        <label>New item scale<select disabled={productionRules} value={scale} onChange={e=>{setScale(Number(e.target.value));setSelected(null);}}><option value="1">1× — atlas native (default)</option><option value="2">2× — controlled comparison</option></select></label>
        <label>Floor lattice<select disabled={productionRules} value={grid} onChange={e=>changeGrid(Number(e.target.value) as GridSize)}><option value="12">12×12</option><option value="16">16×16</option></select></label>
        <label className={styles.check!}><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} />Show isometric grid</label>
        <label className={styles.check!}><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)} />Show selected bounds, anchors, occupied cells</label>
        {item.placement==='wall' && <>
          <label>Wall preview / placement plane<select value={wall} onChange={e=>setWall(e.target.value as Wall)}><option value="left">Left wall — no mirroring</option><option value="right">Right wall — no mirroring</option></select></label>
          <label className={styles.check!}><input type="checkbox" checked={wallPreview} onChange={e=>setWallPreview(e.target.checked)} />Native-perspective comparison ghost</label>
          {wallPreview && <p className={styles.note!}>Diagnostic ghost only, not placed. Whole-art geometric fit: {fitsArt(ghost,item,grid)?'yes':'no — crosses wall boundary'}. Perspective still requires visual review.</p>}
          <label>Observed native perspective<select value={verdicts[item.familyId]??'uncertain'} onChange={e=>setVerdicts({...verdicts,[item.familyId]:e.target.value})}><option value="uncertain">Uncertain / not reviewed</option><option value="left">Fits left</option><option value="right">Fits right</option><option value="neither">Neither</option></select></label>
        </>}
        <div className={styles.row!}>
          <button type="button" onClick={()=>{setSelected(null);setMessage('');}}>New placement</button>
          <button type="button" disabled={!active} onClick={()=>{setPlaced(placed.filter(p=>p.key!==selected));setSelected(null);}}>Remove selected</button>
          <button type="button" onClick={()=>{setPlaced([]);setSelected(null);setMessage('');}}>Clear room</button>
        </div>
        <div className={styles.row!}>
          <label>Floor node U<input type="number" min="0" max={grid} value={nodeU} onChange={e=>setNodeU(Number(e.target.value))} /></label>
          <label>Floor node V<input type="number" min="0" max={grid} value={nodeV} onChange={e=>setNodeV(Number(e.target.value))} /></label>
        </div>
        <button type="button" onClick={()=>commitAt(item.placement==='wall'?wallCenter(wall):floorPoint(nodeU/grid,nodeV/grid))}>{item.placement==='wall'?'Place at selected wall center':'Place / move at floor node'}</button>
        <label>Reproducible review state<select value="" onChange={e=>review(e.target.value as ReviewState)}><option value="" disabled>Load a review state…</option>{REVIEW_STATES.filter(state=>!productionRules||(!state.includes('wall')&&state!=='Sparse 12')).map(state=><option key={state}>{state}</option>)}</select></label>
        <div className={styles.list!} aria-label="Placed objects">{placed.length===0 ? <span>No placed objects</span> : placed.map(p=><button type="button" className={p.key===selected?styles.selected!:''} key={p.key} onClick={()=>select(p)} onKeyDown={e=>{
          if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
          e.preventDefault();setSelected(p.key);
          const a = anchorPosition(p,grid), d = getItem(p);
          const delta: Point = e.key==='ArrowRight'?[1,0]:e.key==='ArrowLeft'?[-1,0]:e.key==='ArrowDown'?[0,1]:[0,-1];
          const next = d.placement==='wall' ? {...p,position:[a[0]+delta[0]*4,a[1]+delta[1]*4] as Point} : {...p,u:p.u+delta[0]/grid,v:p.v+delta[1]/grid};
          const error=checkPlacement(next,d,placed,decorations,grid);
          if (error) setMessage(error); else {setPlaced(placed.map(old=>old.key===p.key?next:old));setMessage('');}
        }}>{p.key}: {getItem(p).name} · {p.wall??'floor'} · {p.scale}×</button>)}</div>
        <p className={styles.note!}>{placed.length}/{cap} {productionRules?'production floor cap. Mochi reservation enforced.':'development safety cap. Wall and floor occupancy are independent.'} No tabletop placement.</p>
        <table className={styles.table!}><caption>Wall review — local observations only</caption><thead><tr><th>Family</th><th>Prior hypothesis</th><th>Observed</th></tr></thead><tbody>{families.filter(d=>d.placement==='wall').map(d=><tr key={d.familyId}><td>{d.familyId.slice(-3)}</td><td>{d.priorWall}</td><td>{verdicts[d.familyId]??'uncertain'}</td></tr>)}</tbody></table>
      </section>
    </div>
  </main>;
}
