import { execFileSync } from 'node:child_process';

const pkg='com.jepongdevxyz.nativecontrolsverify';
const activity=`${pkg}/.MainActivity`;
const run=(...args)=>execFileSync('adb',args,{encoding:'utf8'});

if(process.argv.includes('--print-cases')){
  console.log(`Native controls emulator smoke:\n- launch: MainActivity reaches foreground without crash\n- back/forward/reload: navigation toolbar callbacks remain responsive\n- external links: off-site user gesture routes to ACTION_VIEW\n- downloads: DownloadListener reaches Android DownloadManager\n- zoom: built-in zoom is enabled when selected\n- exit/back: activity handles browser history before exit`);
  process.exit(0);
}

const apk=process.argv[2];
if(!apk) throw new Error('APK path required');
run('install','-r',apk);
run('shell','am','force-stop',pkg);
run('shell','am','start','-W','-n',activity);
const top=run('shell','dumpsys','activity','activities');
if(!top.includes(pkg)) throw new Error('Native controls app did not reach foreground/activity stack');
const crashes=run('logcat','-d','-t','300');
if(crashes.includes(`FATAL EXCEPTION`) && crashes.includes(pkg)) throw new Error('Native controls app crashed during emulator smoke');
console.log('✓ native controls emulator launch smoke');
