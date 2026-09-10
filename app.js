const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const PERMISSIONS=[
  ['camera','Camera','Android camera access'],
  ['microphone','Microphone','Audio recording access'],
  ['notification','Notifications','Android 13+ notifications'],
  ['location','Location','Fine/coarse location'],
  ['media','Photos & videos','Media library access'],
  ['contacts','Contacts','Android contacts permission'],
  ['calendar','Calendar','Read/write calendar'],
  ['biometrics','Biometrics','Biometric capability permission'],
  ['files','Files & documents','Uses system file flow where supported'],
  ['bluetooth','Bluetooth','Nearby/Bluetooth devices'],
  ['sensors','Sensors','Body sensor permission']
];

const CONTROLS=[
  ['pullRefresh','Pull-down refresh','Native only'],
  ['hideScrollbars','Hide scrollbars','Native only'],
  ['transparentNav','Transparent system bars','Supported engines'],
  ['pinchZoom','Pinch to zoom','Engine-specific'],
  ['disableCopy','Disable text copy','Native only'],
  ['blockAdsRedirects','Block ad redirects','Basic Native filter'],
  ['adguardDns','AdGuard DNS','Requires VPN/DNS layer']
];

const EXTENSIONS=[
  ['adguard','AdGuard AdBlocker','GeckoView'],
  ['ghostery','Ghostery','GeckoView'],
  ['privacyBadger','Privacy Badger','GeckoView'],
  ['darkReader','Dark Reader','GeckoView'],
  ['ublock','uBlock Origin','GeckoView']
];

const OPTION_ICONS={
  camera:'camera',
  microphone:'mic',
  notification:'bell',
  location:'map-pin',
  media:'image',
  contacts:'users',
  calendar:'calendar',
  biometrics:'fingerprint',
  files:'folder',
  bluetooth:'bluetooth',
  sensors:'activity',

  pullRefresh:'refresh-cw',
  hideScrollbars:'eye-off',
  transparentNav:'square',
  pinchZoom:'zoom-in',
  disableCopy:'copy',
  blockAdsRedirects:'shield-off',
  adguardDns:'network',

  adguard:'shield',
  ghostery:'ghost',
  privacyBadger:'lock-keyhole',
  darkReader:'moon',
  ublock:'circle-slash'
};

function refreshIcons(){
  requestAnimationFrame(()=>{
    window.lucide?.createIcons({
      attrs:{
        'stroke-width':2
      }
    });
  });
}

const META={
  native:{
    name:'Native WebView',
    note:'Fast, small APK and the widest Website Controls support.'
  },
  gecko:{
    name:'GeckoView',
    note:'Mozilla engine with runtime Firefox-style extension installation.'
  },
  capacitor:{
    name:'Capacitor',
    note:'Modern Android bridge with runtime permission injection and WebView zoom control.'
  },
  cordova:{
    name:'Cordova',
    note:'Stable hybrid stack with runtime permission injection and WebView zoom control.'
  }
};

const COMPAT={
  native:{
    render:{default:1,hardware:1,software:1},
    permissions:Object.fromEntries(PERMISSIONS.map(([k])=>[k,1])),
    controls:{
      pullRefresh:1,
      hideScrollbars:1,
      transparentNav:1,
      pinchZoom:1,
      disableCopy:1,
      blockAdsRedirects:1,
      adguardDns:0
    },
    extensions:{}
  },

  gecko:{
    render:{default:1,hardware:1,software:0},
    permissions:Object.fromEntries(PERMISSIONS.map(([k])=>[k,1])),
    controls:{
      pullRefresh:0,
      hideScrollbars:0,
      transparentNav:1,
      pinchZoom:0,
      disableCopy:0,
      blockAdsRedirects:0,
      adguardDns:0
    },
    extensions:Object.fromEntries(EXTENSIONS.map(([k])=>[k,1]))
  },

  capacitor:{
    render:{default:1,hardware:1,software:1},
    permissions:Object.fromEntries(PERMISSIONS.map(([k])=>[k,1])),
    controls:{
      pullRefresh:0,
      hideScrollbars:0,
      transparentNav:1,
      pinchZoom:1,
      disableCopy:0,
      blockAdsRedirects:0,
      adguardDns:0
    },
    extensions:{}
  },

  cordova:{
    render:{default:1,hardware:1,software:1},
    permissions:Object.fromEntries(PERMISSIONS.map(([k])=>[k,1])),
    controls:{
      pullRefresh:0,
      hideScrollbars:0,
      transparentNav:1,
      pinchZoom:1,
      disableCopy:0,
      blockAdsRedirects:0,
      adguardDns:0
    },
    extensions:{}
  }
};

const state={
  iconDataUrl:'',
  splashDataUrl:'',
  buildId:null,
  runId:null,
  poll:null,
  currentConfig:null
};

const presetKey='jepong-apk-presets-v2';
const historyKey='jepong-apk-history-v2';
const themeKey='jepong-apk-theme';

function renderOptions(list,host,group){
  host.innerHTML=list.map(([id,label,desc])=>`
    <label
      class="toggle option-toggle"
      data-option="${id}"
      data-desc="${desc}">

      <input
        class="ios-input"
        type="checkbox"
        value="${id}"
        data-group="${group}">

      <span class="option-icon" aria-hidden="true">
        <i data-lucide="${OPTION_ICONS[id] || 'circle'}"></i>
      </span>

      <span class="option-copy">
        <b>${label}</b>
        <small class="support">${desc}</small>
      </span>

      <span class="ios-toggle" aria-hidden="true"></span>
    </label>
  `).join('');

  refreshIcons();
}

renderOptions(PERMISSIONS,$('#permissionsList'),'permissions');
renderOptions(CONTROLS,$('#controlsList'),'controls');
renderOptions(EXTENSIONS,$('#extensionsList'),'extensions');
refreshIcons();

function setEngine(engine){
  $('#engine').value=engine;

  $$('[data-engine]').forEach(card=>{
    card.classList.toggle('active',card.dataset.engine===engine);
  });

  $$('input[name="engine"]').forEach(input=>{
    input.checked=input.value===engine;
  });

  updateCompat();
  updateSummary();
}

$$('input[name="engine"]').forEach(input=>{
  input.addEventListener('change',()=>{
    setEngine(input.value);
  });
});

function updateCompat(){
  const eng=$('#engine').value;
  const c=COMPAT[eng];

  $$('#renderMode option').forEach(option=>{
    option.disabled=!c.render[option.value];
  });

  if($('#renderMode').selectedOptions[0]?.disabled){
    $('#renderMode').value='default';
  }

  for(const group of ['permissions','controls','extensions']){
    $$(`input[data-group="${group}"]`).forEach(input=>{
      const ok=!!c[group]?.[input.value];
      const box=input.closest('.toggle');
      const small=box.querySelector('.support');

      input.disabled=!ok;
      box.classList.toggle('disabled',!ok);

      small.textContent=ok
        ? box.dataset.desc
        : 'Not supported by this engine';

      if(!ok){
        input.checked=false;
      }
    });
  }

  $('#compatNote').textContent=META[eng].note;

  updateCount();
  refreshIcons();
}

function updateCount(){
  for(const [group,id] of [
    ['permissions','#permissionCount'],
    ['controls','#controlCount'],
    ['extensions','#extensionCount']
  ]){
    $(id).textContent=
      $$(`input[data-group="${group}"]:checked`).length;
  }

  updateSummary();
}

$$('.toggle input').forEach(input=>{
  input.addEventListener('change',updateCount);
});

$$('.tab').forEach(button=>{
  button.onclick=()=>{
    $$('.tab').forEach(tab=>{
      tab.classList.toggle('active',tab===button);
    });

    $$('.tab-panel').forEach(panel=>{
      panel.classList.toggle(
        'active',
        panel.id===`panel-${button.dataset.tab}`
      );
    });
  };
});

const val=id=>$(id).value.trim();

const checked=group=>
  $$(`input[data-group="${group}"]:checked`)
    .map(input=>input.value);

function collect(){
  return {
    websiteUrl:val('#websiteUrl'),
    appName:val('#appName'),
    packageName:val('#packageName'),
    versionName:val('#versionName'),
    versionCode:Number($('#versionCode').value),

    engine:$('#engine').value,
    renderMode:$('#renderMode').value,
    orientation:$('#orientation').value,

    permissions:checked('permissions'),
    controls:checked('controls'),
    extensions:checked('extensions'),

    splashEnabled:$('#splashEnabled').checked,
    splashDuration:Number($('#splashDuration').value),

    oneSignalAppId:val('#oneSignalAppId'),
    offlineFallback:val('#offlineFallback'),

    iconDataUrl:state.iconDataUrl,
    splashDataUrl:state.splashDataUrl
  };
}

function validate(c){
  const errors=[];

  try{
    const u=new URL(c.websiteUrl);

    if(!/^https?:$/.test(u.protocol)){
      errors.push('Website URL must use http/https');
    }
  }catch{
    errors.push('Enter a valid Website URL');
  }

  if(!c.appName){
    errors.push('App name is required');
  }

  if(
    !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/
      .test(c.packageName)
  ){
    errors.push('Invalid package name');
  }

  if(!Number.isInteger(c.versionCode) || c.versionCode<1){
    errors.push('Version code must be 1 or higher');
  }

  if(
    c.oneSignalAppId &&
    !/^[0-9a-fA-F-]{36}$/.test(c.oneSignalAppId)
  ){
    errors.push('OneSignal App ID must be a UUID');
  }

  return errors;
}

function updateSummary(){
  const eng=$('#engine').value;

  $('#summaryEngine').textContent=META[eng].name;

  $('#summaryPackage').textContent=
    val('#packageName') || '—';

  $('#previewName').textContent=
    val('#appName') || 'Your app';

  const total=
    checked('permissions').length +
    checked('controls').length +
    checked('extensions').length;

  $('#summaryFeatures').textContent=
    `${total} feature${total===1?'':'s'}`;

  try{
    $('#previewDomain').textContent=
      new URL(val('#websiteUrl')).hostname ||
      'yourwebsite.com';
  }catch{
    $('#previewDomain').textContent='yourwebsite.com';
  }
}

[
  '#websiteUrl',
  '#appName',
  '#packageName',
  '#versionName',
  '#versionCode',
  '#orientation',
  '#renderMode',
  '#splashEnabled',
  '#splashDuration',
  '#oneSignalAppId',
  '#offlineFallback'
].forEach(selector=>{
  $(selector)?.addEventListener('input',updateSummary);
});

async function imageToPng(file,maxW,maxH){
  if(!file) return '';

  const img=await createImageBitmap(file);

  const scale=Math.min(
    1,
    maxW/img.width,
    maxH/img.height
  );

  const canvas=document.createElement('canvas');

  canvas.width=Math.max(
    1,
    Math.round(img.width*scale)
  );

  canvas.height=Math.max(
    1,
    Math.round(img.height*scale)
  );

  canvas.getContext('2d')
    .drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

  img.close?.();

  return canvas.toDataURL(
    'image/png',
    .9
  );
}

function setPreview(selector,url){
  const el=$(selector);

  const fallback=
    selector==='#iconPreview'
      ? '/assets/default-icon.png'
      : '/assets/default-splash.png';

  el.style.backgroundImage=
    `url(${url || fallback})`;

  el.textContent='';

  if(selector==='#iconPreview'){
    $('#miniLogo').style.backgroundImage=
      `url(${url || fallback})`;

    $('#miniLogo').textContent='';
  }
}

$('#iconInput').addEventListener(
  'change',
  async event=>{
    try{
      state.iconDataUrl=
        await imageToPng(
          event.target.files[0],
          512,
          512
        );

      setPreview(
        '#iconPreview',
        state.iconDataUrl
      );

      toast(
        'App icon prepared',
        'ok'
      );
    }catch{
      toast(
        'Could not process image',
        'error'
      );
    }
  }
);

$('#splashInput').addEventListener(
  'change',
  async event=>{
    try{
      state.splashDataUrl=
        await imageToPng(
          event.target.files[0],
          1080,
          1920
        );

      setPreview(
        '#splashPreview',
        state.splashDataUrl
      );

      toast(
        'Splash image prepared',
        'ok'
      );
    }catch{
      toast(
        'Could not process image',
        'error'
      );
    }
  }
);

setPreview('#iconPreview','');
setPreview('#splashPreview','');

function toast(message,type=''){
  const element=document.createElement('div');

  element.className=
    `toast ${type}`;

  element.textContent=message;

  $('#toasts').append(element);

  setTimeout(
    ()=>element.remove(),
    3800
  );
}

function getPresets(){
  try{
    return JSON.parse(
      localStorage.getItem(presetKey) ||
      '[]'
    );
  }catch{
    return [];
  }
}

function setPresets(value){
  localStorage.setItem(
    presetKey,
    JSON.stringify(value)
  );
}

function getHistory(){
  try{
    return JSON.parse(
      localStorage.getItem(historyKey) ||
      '[]'
    );
  }catch{
    return [];
  }
}

function setHistory(value){
  localStorage.setItem(
    historyKey,
    JSON.stringify(value)
  );
}

function escapeHtml(value){
  return String(value).replace(
    /[&<>"']/g,
    char=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[char])
  );
}

$('#savePresetBtn').onclick=()=>{
  const name=prompt(
    'Preset name:',
    'My APK preset'
  );

  if(!name) return;

  const list=getPresets();

  list.unshift({
    id:crypto.randomUUID(),
    name,
    createdAt:new Date().toISOString(),
    config:collect()
  });

  setPresets(
    list.slice(0,30)
  );

  toast(
    'Preset saved',
    'ok'
  );
};

function applyConfig(config){
  const fields={
    websiteUrl:'#websiteUrl',
    appName:'#appName',
    packageName:'#packageName',
    versionName:'#versionName',
    versionCode:'#versionCode',
    renderMode:'#renderMode',
    orientation:'#orientation',
    splashDuration:'#splashDuration',
    oneSignalAppId:'#oneSignalAppId',
    offlineFallback:'#offlineFallback'
  };

  for(
    const [key,selector]
    of Object.entries(fields)
  ){
    if(config[key]!=null){
      $(selector).value=config[key];
    }
  }

  setEngine(
    config.engine || 'native'
  );

  $('#splashEnabled').checked=
    config.splashEnabled!==false;

  for(
    const group of
    ['permissions','controls','extensions']
  ){
    $$(`input[data-group="${group}"]`)
      .forEach(input=>{
        input.checked=
          (config[group] || [])
            .includes(input.value)
          && !input.disabled;
      });
  }

  state.iconDataUrl=
    config.iconDataUrl || '';

  state.splashDataUrl=
    config.splashDataUrl || '';

  setPreview(
    '#iconPreview',
    state.iconDataUrl
  );

  setPreview(
    '#splashPreview',
    state.splashDataUrl
  );

  updateCompat();
  updateSummary();
}

function showPresets(){
  const list=getPresets();

  $('#presetList').innerHTML=
    list.length
      ? list.map(preset=>`
          <div class="preset-item">
            <div>
              <b>${escapeHtml(preset.name)}</b>
              <small>
                ${new Date(
                  preset.createdAt
                ).toLocaleString()}
              </small>
            </div>

            <div class="preset-actions">
              <button
                class="mini-button"
                data-load="${preset.id}">
                Load
              </button>

              <button
                class="mini-button"
                data-del="${preset.id}">
                Delete
              </button>
            </div>
          </div>
        `).join('')
      : '<div class="note">No saved presets yet.</div>';

  $$(
    '[data-load]',
    $('#presetList')
  ).forEach(button=>{
    button.onclick=()=>{
      const preset=
        getPresets()
          .find(
            x=>x.id===button.dataset.load
          );

      if(preset){
        applyConfig(preset.config);
        $('#presetModal').close();

        toast(
          'Preset loaded',
          'ok'
        );
      }
    };
  });

  $$(
    '[data-del]',
    $('#presetList')
  ).forEach(button=>{
    button.onclick=()=>{
      setPresets(
        getPresets()
          .filter(
            x=>x.id!==button.dataset.del
          )
      );

      showPresets();
    };
  });

  $('#presetModal').showModal();
}

$('#presetsBtn').onclick=
  showPresets;

$('#closePresets').onclick=
  ()=>$('#presetModal').close();

function saveHistory(record){
  const list=
    getHistory()
      .filter(
        item=>
          item.buildId !== record.buildId
      );

  list.unshift(record);

  setHistory(
    list.slice(0,30)
  );

  renderHistory();
}

function renderHistory(){
  const list=getHistory();

  $('#historyList').innerHTML=
    list.length
      ? list.map(item=>`
          <div class="history-item">
            <div class="row">
              <div>
                <b>
                  ${escapeHtml(
                    item.appName || 'APK'
                  )}
                </b>
                <br>

                <small>
                  ${escapeHtml(
                    META[item.engine]?.name ||
                    item.engine ||
                    ''
                  )}
                  ·
                  ${new Date(
                    item.createdAt
                  ).toLocaleString()}
                </small>
              </div>

              <span class="state-pill ${
                item.conclusion==='success'
                  ? 'success'
                  : ''
              }">
                ${escapeHtml(
                  item.conclusion ||
                  item.status ||
                  'queued'
                )}
              </span>
            </div>
          </div>
        `).join('')
      : '<div class="note">No builds yet.</div>';
}

renderHistory();
refreshIcons();

function openDrawer(){
  $('#historyDrawer')
    .classList.add('open');

  $('#drawerBackdrop')
    .classList.add('open');
}

function closeDrawer(){
  $('#historyDrawer')
    .classList.remove('open');

  $('#drawerBackdrop')
    .classList.remove('open');
}

$('#historyBtn').onclick=
  openDrawer;

$('#drawerBackdrop').onclick=
  closeDrawer;

$$('[data-close-drawer]')
  .forEach(button=>{
    button.onclick=closeDrawer;
  });

function renderTimeline(steps=[]){
  const interesting=
    steps
      .filter(
        step=>
          !/^(Post |Set up job|Complete job)/
            .test(step.name)
      )
      .slice(-8);

  $('#stepTimeline').innerHTML=
    interesting.map(step=>`
      <span class="timeline-chip ${
        step.status==='in_progress'
          ? 'active'
          : step.conclusion==='success'
            ? 'ok'
            : step.conclusion &&
              step.conclusion!=='skipped'
              ? 'fail'
              : ''
      }">
        ${escapeHtml(step.name)}
      </span>
    `).join('');
}

async function startBuild(){
  const config=collect();
  const errors=validate(config);

  if(errors.length){
    return toast(
      errors.join(' · '),
      'error'
    );
  }

  state.currentConfig=config;

  $('#successCard')
    .classList.add('hidden');

  $('#buildReady')
    .classList.add('hidden');

  $('#buildState')
    .classList.remove('hidden');

  $('#buildBtn').disabled=true;

  $('#progressBar')
    .style.width='2%';

  $('#progressText')
    .textContent='2%';

  $('#currentStep')
    .textContent=
      'Sending build configuration';

  renderTimeline([]);

  try{
    const response=
      await fetch(
        '/api/build-create',
        {
          method:'POST',
          headers:{
            'Content-Type':
              'application/json'
          },
          body:JSON.stringify(config)
        }
      );

    const data=
      await response.json();

    if(!response.ok){
      throw new Error(
        data.error ||
        data.errors?.join(', ') ||
        'Build request failed'
      );
    }

    state.buildId=
      data.buildId;

    $('#buildTitle').textContent=
      `${config.appName} · ${
        META[config.engine].name
      }`;

    $('#buildSubtitle').textContent=
      data.buildId;

    $('#logsBuildId').textContent=
      data.buildId;

    saveHistory({
      buildId:data.buildId,
      appName:config.appName,
      engine:config.engine,
      status:'queued',
      createdAt:new Date()
        .toISOString()
    });

    pollStatus(config);

  }catch(error){
    $('#buildState')
      .classList.add('hidden');

    $('#buildReady')
      .classList.remove('hidden');

    $('#buildBtn').disabled=false;

    toast(
      error.message,
      'error'
    );
  }
}

$('#buildBtn').onclick=
  startBuild;

async function pollStatus(config){
  clearInterval(state.poll);

  let busy=false;

  const tick=async()=>{
    if(busy) return;
    busy=true;

    try{
      const response=
        await fetch(
          `/api/build-status?buildId=${
            encodeURIComponent(
              state.buildId
            )
          }`,
          {
            cache:'no-store'
          }
        );

      const data=
        await response.json();

      if(data.error){
        throw new Error(data.error);
      }

      state.runId=
        data.runId ||
        state.runId;

      const progress=
        Math.max(
          2,
          data.progress || 2
        );

      $('#progressBar')
        .style.width=
          `${progress}%`;

      $('#progressText')
        .textContent=
          `${progress}%`;

      $('#currentStep')
        .textContent=
          data.currentStep ||
          data.status ||
          'Queued';

      renderTimeline(
        data.steps || []
      );

      saveHistory({
        buildId:state.buildId,
        appName:config.appName,
        engine:config.engine,
        status:data.status || 'queued',
        conclusion:data.conclusion || '',
        createdAt:new Date()
          .toISOString()
      });

      if(data.status==='completed'){
        clearInterval(state.poll);

        $('#buildBtn').disabled=false;

        if(data.conclusion==='success'){
          $('#buildState')
            .classList.add('hidden');

          $('#successCard')
            .classList.remove('hidden');

          $('#downloadBtn').href=
            `/api/build-download?runId=${
              encodeURIComponent(
                data.runId
              )
            }`;

          toast(
            'APK build completed',
            'ok'
          );

        }else{
          $('#buildState')
            .classList.add('hidden');

          $('#buildReady')
            .classList.remove('hidden');

          toast(
            `Build failed: ${
              data.conclusion ||
              'unknown'
            }`,
            'error'
          );
        }
      }

    }catch(error){
      console.warn(error);

    }finally{
      busy=false;
    }
  };

  await tick();

  state.poll=
    setInterval(
      tick,
      3000
    );
}

async function loadLogs(){
  if(!state.buildId){
    $('#logsText')
      .textContent=
        'Start a build first.';
    return;
  }

  $('#logsText')
    .textContent=
      'Loading logs…';

  try{
    const response=
      await fetch(
        `/api/build-logs?buildId=${
          encodeURIComponent(
            state.buildId
          )
        }`,
        {
          cache:'no-store'
        }
      );

    const data=
      await response.json();

    $('#logsText')
      .textContent=
        data.text ||
        data.error ||
        'No logs yet.';

  }catch(error){
    $('#logsText')
      .textContent=
        error.message;
  }
}

$('#logsBtn').onclick=
  async()=>{
    $('#logsModal').showModal();
    await loadLogs();
  };

$('#refreshLogs').onclick=
  loadLogs;

$('#closeLogs').onclick=
  ()=>$('#logsModal').close();

$('#resetBtn').onclick=()=>{
  if(
    !confirm(
      'Reset the builder form?'
    )
  ){
    return;
  }

  applyConfig({
    websiteUrl:
      'https://example.com',

    appName:
      'Jepong Devxyz',

    packageName:
      'com.jepongdevxyz.app',

    versionName:
      '1.0.0',

    versionCode:1,

    engine:
      'native',

    renderMode:
      'default',

    orientation:
      'auto',

    permissions:[],
    controls:[],
    extensions:[],

    splashEnabled:true,
    splashDuration:1500,

    oneSignalAppId:'',

    offlineFallback:
      'You appear to be offline. Check your connection and try again.',

    iconDataUrl:'',
    splashDataUrl:''
  });

  toast(
    'Builder reset',
    'ok'
  );
};

function applyTheme(theme){
  document.documentElement
    .dataset.theme=theme;

  localStorage.setItem(
    themeKey,
    theme
  );
}

applyTheme(
  localStorage.getItem(themeKey) ||
  'dark'
);

$('#themeBtn').onclick=()=>{
  applyTheme(
    document.documentElement
      .dataset.theme==='dark'
        ? 'light'
        : 'dark'
  );
};

updateCompat();
updateSummary();
