var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.set(0,1.5,3);
var renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls=new THREE.OrbitControls(camera,renderer.domElement);

// Loader and logging
var loaderEl=document.getElementById('loader');
function setLoaderVisible(visible) {
  loaderEl.style.display=visible?'inline-block':'none';
}
function log(msg,type="info") {
  var c=document.getElementById('console');
  var div=document.createElement('div');
  var emoji="";
  if(type==="info") emoji="ℹ️";
  else if(type==="error") emoji="❌";
  else if(type==="success") emoji="✔️";
  else if(type==="warn") emoji="⚠️";
  
  div.className='log-'+type;
  div.innerHTML=emoji+" "+msg;
  c.appendChild(div);
  c.scrollTop=c.scrollHeight;
}
function makeColorTexture(color) {
  var size=64;
  var canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle=color;
  ctx.fillRect(0,0,size,size);
  var texture=new THREE.Texture(canvas);
  texture.needsUpdate=true;
  return texture;
}

// Load options and states
var disableAnimations=localStorage.getItem('disableAnimations')==='true';
var showUIState=localStorage.getItem('showUI');
var showUI=(showUIState===null)?true:(showUIState==='true');
var manualModeState=localStorage.getItem('manualMode');
var manualMode=(manualModeState==='true');

// UI elements
var ui=document.getElementById('ui');
var toggleBtn=document.getElementById('toggleUI');
var manualModeBtn=document.getElementById('manualModeBtn');

if(!showUI){ui.style.display='none';toggleBtn.textContent='Show UI';}
updateManualModeBtnText();

// Manual mode button and controls setup
function updateManualModeBtnText(){
  manualModeBtn.textContent="Manual Mode: "+(manualMode?"ON":"OFF");
}

function updateControls(){
  // In manual mode, left click should rotate puzzle, right click rotate camera.
  // Configure OrbitControls so that left does nothing, right rotates.
  if(manualMode){
    controls.enableRotate=true;
    // Default OrbitControls: LEFT:ROTATE,MIDDLE:DOLLY,RIGHT:PAN
    // We want: LEFT: none, MIDDLE:DOLLY, RIGHT:ROTATE
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
  } else {
    // Restore default
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
  }
}

manualModeBtn.addEventListener('click',function(){
  manualMode=!manualMode;
  localStorage.setItem('manualMode',manualMode);
  updateManualModeBtnText();
  updateControls();
});

updateControls();

var stickerTextures={
  yellow:makeColorTexture('#FFFF00'),
  blue:makeColorTexture('#0000FF'),
  red:makeColorTexture('#FF0000'),
  green:makeColorTexture('#00FF00')
};

var cornerPositions=[
  new THREE.Vector3(0,0,1),
  new THREE.Vector3(Math.sqrt(8/9),0,-1/3),
  new THREE.Vector3(-Math.sqrt(2/9),Math.sqrt(2/3),-1/3),
  new THREE.Vector3(-Math.sqrt(2/9),-Math.sqrt(2/3),-1/3)
];
var facesIndices=[[0,1,2],[0,2,3],[0,3,1],[1,3,2]];
function edgePoint(a,b,t){return new THREE.Vector3().lerpVectors(a,b,t);}
function faceCenter(pts){return new THREE.Vector3().addVectors(pts[0],pts[1]).add(pts[2]).divideScalar(3);}
var group=new THREE.Group();
scene.add(group);

var pieces=[];
var faceCornerCache=[]; 
for(var f=0;f<4;f++){
  faceCornerCache[f]=facesIndices[f].map(i=>cornerPositions[i]);
}
function createStickerTriangle(faceIndex,idx,p1,p2,p3,map){
  var g=new THREE.BufferGeometry();
  var verts=new Float32Array([
    p1.x,p1.y,p1.z,
    p2.x,p2.y,p2.z,
    p3.x,p3.y,p3.z
  ]);
  g.setAttribute('position',new THREE.BufferAttribute(verts,3));
  g.computeVertexNormals();
  
  var uvs=new Float32Array([0.5,1.0,0,0,1,0]);
  g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  
  var m=new THREE.MeshPhongMaterial({map:map,shininess:30});
  var mesh=new THREE.Mesh(g,m);

  var lineGeo = new THREE.EdgesGeometry(g);
  var lineMat = new THREE.LineBasicMaterial({color:0x000000});
  var line = new THREE.LineSegments(lineGeo, lineMat);
  mesh.add(line);

  mesh.userData={faceIndex:faceIndex,localIndex:idx};

  return mesh;
}
for(var ff=0;ff<4;ff++){
  var c=faceCornerCache[ff];
  var center=faceCenter(c);
  var vPairs=[[0,1],[1,2],[2,0]];
  var layerCoords=[];
  for(var i=0;i<3;i++){
    layerCoords.push(edgePoint(c[vPairs[i][0]],c[vPairs[i][1]],1/3));
    layerCoords.push(edgePoint(c[vPairs[i][0]],c[vPairs[i][1]],2/3));
  }
  var colorKeys=["yellow","blue","red","green"];
  var faceColor=stickerTextures[colorKeys[ff]];
  var faceGroup=new THREE.Group();

  var topTris=[
    [c[0],layerCoords[0],layerCoords[5]],
    [c[1],layerCoords[2],layerCoords[1]],
    [c[2],layerCoords[4],layerCoords[3]]
  ];
  for(var i=0;i<topTris.length;i++){
    var t=topTris[i];
    var tri=createStickerTriangle(ff,i,t[0],t[1],t[2],faceColor);
    faceGroup.add(tri);
    pieces.push(tri);
  }

  for(var i=0;i<layerCoords.length;i++){
    var t=[center,layerCoords[i],layerCoords[(i+1)%layerCoords.length]];
    var idx=3+i;
    var tri=createStickerTriangle(ff,idx,t[0],t[1],t[2],faceColor);
    faceGroup.add(tri);
    pieces.push(tri);
  }
  group.add(faceGroup);
}

var light=new THREE.DirectionalLight(0xffffff,1);
light.position.set(2,2,2);
scene.add(light);
scene.add(new THREE.AmbientLight(0x555555));

var rotationAxes=[
  {corner:0,neighbors:[1,2,3],axis:null},
  {corner:1,neighbors:[0,3,2],axis:null},
  {corner:2,neighbors:[0,1,3],axis:null},
  {corner:3,neighbors:[0,2,1],axis:null}
];
for(var i=0;i<4;i++){
  var va=cornerPositions[i];
  rotationAxes[i].axis=va.clone().normalize();
}

function attach(child, scene, parent){
  scene.updateMatrixWorld(true);
  child.updateMatrixWorld(true);
  var matrix=child.matrixWorld.clone();
  scene.remove(child);
  parent.add(child);
  parent.updateMatrixWorld(true);
  child.matrix.copy(parent.matrixWorld.clone().invert());
  child.matrix.multiply(matrix);
  child.matrix.decompose(child.position,child.quaternion,child.scale);
}
function detach(child, parent, scene){
  parent.updateMatrixWorld(true);
  child.updateMatrixWorld(true);
  var matrix=child.matrixWorld.clone();
  parent.remove(child);
  scene.add(child);
  child.matrix.copy(matrix);
  child.matrix.decompose(child.position,child.quaternion,child.scale);
}

var twisting=false;
var twistStart=0;
var twistDuration=0.3;
var twistFrom=0;
var twistTo=0;
var twistAxis=new THREE.Vector3();
var twistPieces=[];
var onTwistComplete=null;
var twistingGroup=new THREE.Group();
scene.add(twistingGroup);

function getLayerPieces(axisIndex,isTip=false){
  var ax=rotationAxes[axisIndex];
  var axis=ax.axis.clone();
  var threshold=isTip?0.9:0.3; 
  var selected=[];
  var tempBox=new THREE.Box3();
  group.updateMatrixWorld(true);
  group.traverse(function(o){
    if(o.isMesh){
      tempBox.setFromObject(o);
      var center=tempBox.getCenter(new THREE.Vector3());
      var proj=center.clone().normalize();
      var dot=proj.dot(axis);
      if(dot>threshold) selected.push({obj:o,dot:dot});
    }
  });

  if(isTip){
    // Sort by dot descending, pick top 3 only
    selected.sort((a,b)=>b.dot - a.dot);
    selected=selected.slice(0,3);
  }

  return selected.map(x=>x.obj);
}

var rotateCommandQueue=[]; 
var isRunning=false; 

function applyRotationInstant(axisIndex,dir,isTip){
  var layer=getLayerPieces(axisIndex,isTip);
  for(var i=0;i<layer.length;i++){
    attach(layer[i], scene, twistingGroup);
  }
  var angle=Math.PI*2/3*(dir>0?1:-1);
  twistingGroup.setRotationFromAxisAngle(rotationAxes[axisIndex].axis, angle);
  for(var i=0;i<layer.length;i++){
    detach(layer[i],twistingGroup,group);
  }
  twistingGroup.rotation.set(0,0,0);
}

function rotateAxis(axisIndex,dir,isTip=false,cb){
  if(disableAnimations){
    applyRotationInstant(axisIndex, dir, isTip);
    if(cb)cb();
    checkIfDone();
    return;
  }

  if(twisting) { 
    rotateCommandQueue.push({axisIndex:axisIndex, dir:dir, cb:cb, isTip:isTip});
    return; 
  }
  twistAxis=rotationAxes[axisIndex].axis.clone();
  twistPieces=getLayerPieces(axisIndex,isTip);
  for(var i=0;i<twistPieces.length;i++){
    attach(twistPieces[i], scene, twistingGroup);
  }
  twistFrom=0;
  twistTo=Math.PI*2/3*(dir>0?1:-1);
  twistStart=performance.now()/1000;
  twisting=true;
  onTwistComplete=function(){
    if(cb)cb();
    if(rotateCommandQueue.length>0){
      var next=rotateCommandQueue.shift();
      rotateAxis(next.axisIndex,next.dir,next.isTip,next.cb);
    } else {
      checkIfDone();
    }
  };
}

window.rotateLayerCommand=function(faceIndex,dir){
  rotateAxis(faceIndex,dir,false);
};
window.rotateAxisCommand=function(faceIndex,dir,isTip){
  rotateAxis(faceIndex,dir,isTip);
};

function faceLocalCoordinates(faceIndex){
  var c=faceCornerCache[faceIndex];
  var u=c[1].clone().sub(c[0]); u.normalize();
  var n=(new THREE.Vector3()).crossVectors(
    c[1].clone().sub(c[0]),
    c[2].clone().sub(c[0])
  ).normalize();
  var v=new THREE.Vector3().crossVectors(n,u);
  return {origin:c[0],u:u,v:v};
}

function getPyraminxStateStructure() {
  var state=[
    {faceIndex:0,triangles:[]},
    {faceIndex:1,triangles:[]},
    {faceIndex:2,triangles:[]},
    {faceIndex:3,triangles:[]}
  ];

  var tempBox=new THREE.Box3();
  group.updateMatrixWorld(true);

  var piecePositions=[];
  for(var i=0;i<pieces.length;i++){
    var p=pieces[i];
    tempBox.setFromObject(p);
    var center=tempBox.getCenter(new THREE.Vector3());
    var dir=center.clone().normalize();
    var bestFace=-1;
    var bestDot=-1;
    for(var ff=0;ff<4;ff++){
      var dot=dir.dot(rotationAxes[ff].axis);
      if(dot>bestDot){bestDot=dot;bestFace=ff;}
    }
    piecePositions.push({mesh:p,center:center,face:bestFace});
  }

  for(var f=0;f<4;f++){
    var facePieces=piecePositions.filter(pp=>pp.face===f);
    var coords=faceLocalCoordinates(f);
    facePieces.forEach(pp=>{
      var rel=pp.center.clone().sub(coords.origin);
      var x=rel.dot(coords.u);
      var y=rel.dot(coords.v);
      pp.x=x;pp.y=y;
    });
    facePieces.sort((a,b)=>{
      if(b.y===a.y) return a.x-b.x;
      return b.y - a.y;
    });

    for(var i=0;i<facePieces.length;i++){
      var tex=facePieces[i].mesh.material.map;
      var col=(tex===stickerTextures.yellow)?"yellow":
               (tex===stickerTextures.blue)?"blue":
               (tex===stickerTextures.red)?"red":"green";
      state[f].triangles.push({color:col});
    }
  }

  return state;
}

window.getCurrentState=function(){
  var st=getPyraminxStateStructure();
  log("Current State:\n"+JSON.stringify(st,null,2),"info");
};

function scramble(){
  for(var i=0;i<8;i++){
    var axisIndex=Math.floor(Math.random()*4);
    var dir=(Math.random()<0.5)?1:-1;
    applyRotationInstant(axisIndex,dir,false);
  }
}

function checkIfDone(){
  if(!twisting && rotateCommandQueue.length===0){
    isRunning=false;
    setLoaderVisible(false);
  }
}

// Draggable logic for windows, including main ui
function makeDraggable(header,windowEl,closeBtnId){
  var offsetX=0,offsetY=0,dragging=false;
  header.addEventListener('mousedown',function(e){
    if(e.target.id===closeBtnId) return; 
    dragging=true;
    offsetX=e.clientX-windowEl.offsetLeft;
    offsetY=e.clientY-windowEl.offsetTop;
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('mousemove',function(e){
    if(dragging){
      windowEl.style.left=(e.clientX-offsetX)+'px';
      windowEl.style.top=(e.clientY-offsetY)+'px';
    }
  });
  document.addEventListener('mouseup',function(){
    dragging=false;
  });
}

// Make main UI draggable
var uiHeader=document.getElementById('uiHeader');
makeDraggable(uiHeader,ui,'closeBtn');

var infoWindow=document.getElementById('infoWindow');
var infoHeader=document.getElementById('infoHeader');
var infoCloseBtn=document.getElementById('infoCloseBtn');
var infoBtn=document.getElementById('infoBtn');
makeDraggable(infoHeader,infoWindow,'infoCloseBtn');

infoBtn.addEventListener('click',function(){
  infoWindow.style.display=(infoWindow.style.display==='none' || infoWindow.style.display==='')?'block':'none';
});

infoCloseBtn.addEventListener('click',function(){
  infoWindow.style.display='none';
});

var optionsWindow=document.getElementById('optionsWindow');
var optionsHeader=document.getElementById('optionsHeader');
var optionsCloseBtn=document.getElementById('optionsCloseBtn');
var optionsBtn=document.getElementById('optionsBtn');
makeDraggable(optionsHeader,optionsWindow,'optionsCloseBtn');

var disableAnimationsCheckbox=document.getElementById('disableAnimationsCheckbox');
disableAnimationsCheckbox.checked=disableAnimations;

optionsBtn.addEventListener('click',function(){
  optionsWindow.style.display=(optionsWindow.style.display==='none' || optionsWindow.style.display==='')?'block':'none';
});

optionsCloseBtn.addEventListener('click',function(){
  optionsWindow.style.display='none';
});

disableAnimationsCheckbox.addEventListener('change',function(){
  disableAnimations=this.checked;
  localStorage.setItem('disableAnimations',disableAnimations);
});

var runBtn=document.getElementById('runBtn');
runBtn.addEventListener('click',function(){
  if(isRunning){
    log("A run is already in progress. Please wait until it finishes.","warn");
    return;
  }
  var code=document.getElementById('codeInput').value.trim();
  if(!code){
    log("No code entered, nothing to run.","warn");
    return;
  }
  isRunning=true;
  setLoaderVisible(true);
  log("Scrambling before execution...","warn");
  scramble();
  setTimeout(function(){
    log("Running user code...","info");
    try {
      eval(code);
    } catch(e){
      log("Error: "+e,"error");
      isRunning=false;
      setLoaderVisible(false);
    }
    checkIfDone();
  },1000);
});

if(!showUI){
  ui.style.display='none';
  toggleBtn.textContent='Show UI';
}
toggleBtn.addEventListener('click',function(){
  if(ui.style.display==='none'){
    ui.style.display='flex';
    toggleBtn.textContent='Toggle UI';
    localStorage.setItem('showUI',true);
  } else {
    ui.style.display='none';
    toggleBtn.textContent='Show UI';
    localStorage.setItem('showUI',false);
  }
});

document.getElementById('closeBtn').addEventListener('click',function(){
  ui.style.display='none';
  toggleBtn.textContent='Show UI';
  localStorage.setItem('showUI',false);
});

// Manual mode highlight logic
var raycaster=new THREE.Raycaster();
var mouse=new THREE.Vector2();
var lastHighlightedPieces=[];

function highlightPieces(piecesToHighlight){
  // revert old highlight
  lastHighlightedPieces.forEach(p=>{
    p.children[0].material.color.set(0x000000);
  });
  lastHighlightedPieces=[];
  // highlight new
  piecesToHighlight.forEach(p=>{
    p.children[0].material.color.set(0xffffff);
  });
  lastHighlightedPieces=piecesToHighlight;
}

function updateHighlight(event){
  if(!manualMode){ 
    highlightPieces([]);
    return;
  }
  if(event.target!==renderer.domElement){
    highlightPieces([]);
    return;
  }
  mouse.x=(event.clientX/window.innerWidth)*2-1;
  mouse.y=-(event.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var intersects=raycaster.intersectObjects(pieces,true);
  if(intersects.length>0){
    var point=intersects[0].point.clone().normalize();
    // Find best axis
    var bestAxis=-1;
    var bestDot=-1;
    for(var i=0;i<rotationAxes.length;i++){
      var dot=point.dot(rotationAxes[i].axis);
      if(dot>bestDot){bestDot=dot;bestAxis=i;}
    }
    var isTip=(bestDot>0.8);
    var layer=getLayerPieces(bestAxis,isTip);
    highlightPieces(layer);
  } else {
    highlightPieces([]);
  }
}

window.addEventListener('mousemove',updateHighlight);

function onSceneClick(event){
  if(!manualMode) return;
  if(event.target!==renderer.domElement) return;

  event.preventDefault();
  event.stopPropagation();

  mouse.x=(event.clientX/window.innerWidth)*2-1;
  mouse.y=-(event.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  var intersects=raycaster.intersectObjects(pieces,true);
  if(intersects.length>0){
    var point=intersects[0].point.clone().normalize();
    var bestAxis=-1;
    var bestDot=-1;
    for(var i=0;i<rotationAxes.length;i++){
      var dot=point.dot(rotationAxes[i].axis);
      if(dot>bestDot){bestDot=dot;bestAxis=i;}
    }
    var dir=event.shiftKey?-1:1;
    var isTip=(bestDot>0.8);
    rotateAxis(bestAxis,dir,isTip);
  }
}

window.addEventListener('mousedown',onSceneClick);

window.addEventListener('resize',function(){
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

log("For help, click the ℹ️ button on the top right.","success");

function animate(){
  var t=performance.now()/1000;
  if(twisting && !disableAnimations){
    var dt=t-twistStart;
    var progress=dt/twistDuration;
    if(progress>=1){
      progress=1;
      twisting=false;
    }
    var eased=progress<0.5?(2*progress*progress):( -1+(4-2*progress)*progress );
    var angle=twistFrom+(twistTo-twistFrom)*eased;
    twistingGroup.setRotationFromAxisAngle(twistAxis,angle);
    if(!twisting){
      for(var i=0;i<twistPieces.length;i++){
        detach(twistPieces[i],twistingGroup,group);
      }
      twistingGroup.rotation.set(0,0,0);
      twistPieces=[];
      if(onTwistComplete) {
        var cb=onTwistComplete;
        onTwistComplete=null;
        cb();
      } else {
        checkIfDone();
      }
    }
  } else if (twisting && disableAnimations) {
    twisting=false;
    twistingGroup.setRotationFromAxisAngle(twistAxis, twistTo);
    for(var i=0;i<twistPieces.length;i++){
      detach(twistPieces[i],twistingGroup,group);
    }
    twistingGroup.rotation.set(0,0,0);
    twistPieces=[];
    if(onTwistComplete) {
      var cb=onTwistComplete;
      onTwistComplete=null;
      cb();
    } else {
      checkIfDone();
    }
  }
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();
