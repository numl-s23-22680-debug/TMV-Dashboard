/**
 * Sanitized Aurora visual/interaction verification. All application requests use
 * the existing API fixture; external requests and operational mutations are
 * blocked. Run only against the local frontend, never an operational deployment.
 *
 * TMV_BASE_URL=http://localhost:3004 node scripts/browser/aurora-review.mjs
 * Optional: TMV_AURORA_MODE=matrix|workflows|contrast; TMV_WIDTHS=390,1366;
 * TMV_THEMES=light,dark; TMV_VIEWS=overview,jobs; TMV_AURORA_OUTPUT=/absolute/path
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {
  browser, base, createFixturePage, apiFixture, fixtureControl, errors, mutations,
  unhandled, repositoryRoot,
} from './capture.mjs';

const out = process.env.TMV_AURORA_OUTPUT || path.join(repositoryRoot, 'docs/screenshots/aurora');
const mode = process.env.TMV_AURORA_MODE || 'all';
const widths = (process.env.TMV_WIDTHS || (mode==='weekly'?'390,1366':'390,768,1024,1366,1440,1920')).split(',').map(Number);
const themes = (process.env.TMV_THEMES || 'light,dark').split(',');
const chosen = (process.env.TMV_VIEWS || '').split(',').filter(Boolean);
const views = [
  { name:'overview', query:'section=overview', ready:page => page.getByRole('heading',{name:/Operations performance/i}).waitFor() },
  { name:'jobs', query:'section=jobs', ready:page => page.getByRole('checkbox',{name:/^Select job DEMO-/}).first().waitFor() },
  { name:'drivers', query:'section=drivers', ready:page => page.getByRole('button',{name:/View profile for/}).first().waitFor() },
  { name:'live-fleet', query:'section=livefleet', ready:page => page.getByText('Current job: DEMO-005',{exact:false}).waitFor() },
  { name:'vehicles', query:'section=van', ready:page => page.getByRole('button',{name:/View vehicle/}).first().waitFor() },
  { name:'evidence', query:'section=liabilities&liabilityTab=checkin', ready:page => page.getByRole('button',{name:/^View evidence/}).first().waitFor() },
  { name:'alerts', query:'section=notifications', ready:page => page.getByText('Message delivery failed',{exact:true}).waitFor() },
  { name:'settings', query:'section=configurations', ready:page => page.getByRole('spinbutton',{name:'1-person crew',exact:false}).waitFor() },
  { name:'summary', query:'section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=summary', report:true, ready:page => page.getByRole('tab',{name:'Summary',exact:true}).waitFor() },
  { name:'jobs-timings', query:'section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=jobs', report:true, ready:page => page.getByRole('tab',{name:'Jobs & timings',exact:true}).waitFor() },
  { name:'payments', query:'section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=payments', report:true, ready:page => page.getByRole('tab',{name:'Payments',exact:true}).waitFor() },
  { name:'road-charges', query:'section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=road', report:true, ready:page => page.getByRole('tab',{name:'Road charges',exact:true}).waitFor() },
  { name:'overview-week', query:'section=overview&from=2026-10-06T23%3A00%3A00.000Z&to=2026-10-13T22%3A59%3A59.999Z', weekly:true, ready:page => page.getByRole('heading',{name:/Operations performance/i}).waitFor() },
];
const selectedViews = views.filter(view => mode==='weekly'?view.weekly:chosen.length?chosen.includes(view.name):!view.weekly);
const results = { matrix:[], workflows:[], contrast:[] };
await fs.mkdir(out,{recursive:true});

async function themedPage(theme,width=1366) {
  const value = await createFixturePage(width,width===390?844:1000);
  value.page.setDefaultTimeout(12000);
  await value.context.addInitScript(next => {
    if(!sessionStorage.getItem('tmv:qa-theme-seeded')){
      localStorage.setItem('tmv:dashboard-theme',next);
      sessionStorage.setItem('tmv:qa-theme-seeded','1');
    }
  },theme);
  return value;
}
async function goto(page,query) {
  await page.goto(base+'/admin?'+query,{waitUntil:'domcontentloaded'});
  await page.locator('html[data-dashboard-theme]').waitFor();
}
async function loaded(page,view) {
  await goto(page,view.query);
  await view.ready(page);
  await page.evaluate(() => document.fonts.ready);
  // Settle the measured layout after completed fixture responses; operational
  // clocks/timestamps remain frozen by the established fixture harness.
  await page.waitForTimeout(200);
}
async function layout(page) {
  return page.evaluate(() => {
    const main=document.getElementById('operations-content');
    const viewport=document.documentElement.clientWidth;
    const clippedHeadings=[...main.querySelectorAll('h1,h2,h3')].flatMap(el => {
      const rect=el.getBoundingClientRect();
      return rect.width&&rect.height&&(rect.left<-.5||rect.right>viewport+.5)
        ?[{text:el.textContent,left:rect.left,right:rect.right}]:[];
    });
    const clippedCharts=[...main.querySelectorAll('.recharts-wrapper,.aurora-radial,.aurora-donut')].flatMap(el=>{
      const rect=el.getBoundingClientRect();
      if(!rect.width||!rect.height||rect.right<=viewport+.5&&rect.left>=-.5)return [];
      let container=el.parentElement;
      while(container&&container!==main){
        if(/auto|scroll/.test(getComputedStyle(container).overflowX))return [];
        container=container.parentElement;
      }
      return [{className:String(el.className),left:rect.left,right:rect.right}];
    });
    return {
      theme:document.documentElement.dataset.dashboardTheme,
      clientWidth:viewport,scrollWidth:document.documentElement.scrollWidth,
      bodyScrollWidth:document.body.scrollWidth,
      pageOverflow:document.documentElement.scrollWidth>viewport+1,
      clippedHeadings,clippedCharts,
      headings:[...main.querySelectorAll('h1,h2,h3')].map(el=>el.textContent.trim()),
    };
  });
}

async function matrix() {
  for(const theme of themes) for(const width of widths) for(const view of selectedViews) {
    if(view.report&&!process.env.TMV_VIEWS&&![390,1366].includes(width))continue;
    const {context,page}=await themedPage(theme,width);
    const started=Date.now();
    let result={name:view.name,theme,width};
    try {
      await loaded(page,view);
      const state=await layout(page);
      const screenshot=`${view.name}-${theme}-${width}.png`;
      await page.screenshot({path:path.join(out,screenshot),fullPage:true});
      result={...result,...state,screenshot,passed:state.theme===theme&&!state.pageOverflow&&!state.clippedHeadings.length&&!state.clippedCharts.length};
      if(result.passed)await fs.rm(path.join(out,`failed-${view.name}-${theme}-${width}.png`),{force:true});
      console.log(`${result.passed?'PASS':'FAIL'} ${view.name} ${theme} ${width}px`);
    } catch(error) {
      result={...result,passed:false,error:error.message};
      await page.screenshot({path:path.join(out,`failed-${view.name}-${theme}-${width}.png`),fullPage:true}).catch(()=>{});
      console.log(`FAIL ${view.name} ${theme} ${width}px: ${error.message}`);
    } finally {
      result.elapsedMs=Date.now()-started;
      results.matrix.push(result);
      await context.close();
    }
  }
}

async function workflow(name,fn,{theme='light',width=1366}={}) {
  if(process.env.TMV_WORKFLOW_FILTER&&!name.toLowerCase().includes(process.env.TMV_WORKFLOW_FILTER.toLowerCase()))return;
  const {context,page}=await themedPage(theme,width);
  try {
    await fn(page,context);
    results.workflows.push({name,passed:true});
    await fs.rm(path.join(out,'failed-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png'),{force:true});
    console.log('PASS '+name);
  } catch(error) {
    results.workflows.push({name,passed:false,error:error.message});
    await page.screenshot({path:path.join(out,'failed-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png'),fullPage:true}).catch(()=>{});
    console.log('FAIL '+name+': '+error.message);
  } finally {
    fixtureControl.errorPaths.clear();fixtureControl.emptyPaths.clear();
    await context.close();
  }
}

async function workflows() {
  await workflow('Theme selection persists through reload, route changes and system changes',async(page)=>{
    await goto(page,'section=overview');
    const control=page.getByRole('combobox',{name:'Dashboard theme',exact:true});
    await control.selectOption('dark');
    await page.waitForFunction(()=>document.documentElement.dataset.dashboardTheme==='dark');
    assert.equal(await page.locator('html').getAttribute('data-dashboard-theme'),'dark');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tmv:dashboard-theme')),'dark');
    await page.reload({waitUntil:'domcontentloaded'});
    await control.waitFor();assert.equal(await control.inputValue(),'dark');
    await page.emulateMedia({colorScheme:'light'});
    assert.equal(await page.locator('html').getAttribute('data-dashboard-theme'),'dark');
    await page.getByRole('button',{name:'Jobs',exact:true}).click();
    await views.find(view=>view.name==='jobs').ready(page);
    assert.equal(await page.locator('html').getAttribute('data-dashboard-theme'),'dark');
    await control.selectOption('system');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tmv:dashboard-theme')),null);
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.dashboardTheme==='dark');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.dashboardTheme==='light');
  });
  await workflow('System theme is followed when there is no saved override',async(page,context)=>{
    await context.clearCookies();
    // The page-level script runs after the fixture init script on every load.
    await page.addInitScript(()=>localStorage.removeItem('tmv:dashboard-theme'));
    await page.emulateMedia({colorScheme:'dark'});
    await goto(page,'section=overview');
    assert.equal(await page.getByRole('combobox',{name:'Dashboard theme'}).inputValue(),'system');
    assert.equal(await page.locator('html').getAttribute('data-dashboard-theme'),'dark');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.dashboardTheme==='light');
  });
  for(const theme of themes) {
    await workflow(`Eight destinations load through the navigation in ${theme} theme`,async(page)=>{
      await goto(page,'section=overview');
      for(const [label,name]of [['Overview','overview'],['Jobs','jobs'],['Drivers','drivers'],['Live Fleet','live-fleet'],['Vehicles','vehicles'],['Evidence & Liability','evidence'],['Alerts','alerts'],['Settings','settings']]){
        await page.getByRole('button',{name:label,exact:true}).click();
        await views.find(view=>view.name===name).ready(page);
        assert.equal(await page.locator('html').getAttribute('data-dashboard-theme'),theme);
      }
    },{theme});
    await workflow(`Mobile navigation, command dialog and theme controls remain keyboard accessible in ${theme}`,async(page)=>{
      await goto(page,'section=overview');
      await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
      const jobs=page.getByRole('button',{name:'Jobs',exact:true});
      await jobs.focus();await page.keyboard.press('Enter');
      await views.find(view=>view.name==='jobs').ready(page);
      const opener=page.getByRole('button',{name:'Jump to page',exact:true});
      await opener.click();
      const dialog=page.getByRole('dialog',{name:'Jump to page'});
      await dialog.waitFor();
      for(let count=0;count<6;count++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
      await page.keyboard.press('Escape');
      assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
      const control=page.getByRole('combobox',{name:'Dashboard theme'});
      await control.focus();assert.equal(await control.evaluate(el=>el===document.activeElement),true);
    },{theme,width:390});
  }
  await workflow('Last 30 days keeps London-local inclusive endpoints and updates URL scope',async(page)=>{
    await loaded(page,views[0]);
    await page.getByRole('button',{name:'Last 30 days',exact:true}).click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('from')?.startsWith('2026-09-13'));
    const params=new URL(page.url()).searchParams;
    assert.equal(params.get('from'),'2026-09-13T23:00:00.000Z');
    assert.equal(params.get('to'),'2026-10-13T22:59:59.999Z');
    assert.equal(await page.getByLabel('From date',{exact:true}).inputValue(),'2026-09-14');
    assert.equal(await page.getByLabel('To date',{exact:true}).inputValue(),'2026-10-13');
  });
  await workflow('Status composition exposes values, highlights keyboard focus and opens the exact filter',async(page)=>{
    await loaded(page,views[0]);
    const chart=page.getByRole('img',{name:/Job status composition/});
    await chart.first().waitFor();
    assert.match(await chart.first().getAttribute('aria-labelledby'),/.+-title/);
    const completed=page.getByRole('button',{name:/^View completed jobs: /}).first();
    const count=fixtureControl.allJobs.filter(job=>job.status==='COMPLETED').length;
    assert.equal(await completed.getAttribute('aria-label'),`View completed jobs: ${count}`);
    await completed.focus();
    assert.match(await completed.getAttribute('class'),/is-highlighted/);
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Jobs',exact:true}).waitFor();
    const query=new URL(page.url()).searchParams;
    assert.equal(query.get('section'),'jobs');assert.equal(query.get('status'),'COMPLETED');
    assert.ok(query.get('from')&&query.get('to'));
  });
  await workflow('Overview final charges agree with stored charged amounts and distinguish receipts',async(page)=>{
    await loaded(page,views[0]);
    const metric=page.locator('.ops-metric').filter({has:page.getByText('Final charges',{exact:true})});
    const known=fixtureControl.allJobs.reduce((sum,job)=>sum+job.amountCharged,0);
    const expected=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(known/100);
    assert.match(await metric.innerText(),new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(await metric.innerText(),/not (?:money )?(?:received|receipts)|separate from receipts|charge.*receipts|receipts.*separate/i);
  });
  await workflow('Activity switching retains chronological values and heatmap opens one London day',async(page)=>{
    await loaded(page,views[0]);
    // This fixture has reported daily values within 7–11 October. Dates with no
    // reported value remain unavailable, rather than interactive measured zeros.
    await page.getByRole('button',{name:'Last 7 days',exact:true}).click();
    const options=page.getByRole('group',{name:'Activity visualization',exact:true});
    await options.getByRole('button',{name:'Distribution',exact:true}).click();
    assert.equal(await options.getByRole('button',{name:'Distribution',exact:true}).getAttribute('aria-pressed'),'true');
    await options.getByRole('button',{name:'Trends',exact:true}).click();
    await page.getByText('View activity values and basis',{exact:true}).click();
    assert.ok(await page.getByRole('table').count()>0);
    await options.getByRole('button',{name:'Activity heatmap',exact:true}).click();
    const day=page.locator('.aurora-heatmap-cell:not([disabled])').first();
    await day.focus();await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Jobs',exact:true}).waitFor();
    const query=new URL(page.url()).searchParams;
    assert.equal(query.get('section'),'jobs');
    assert.ok(query.get('from')?.endsWith('T23:00:00.000Z'));
    assert.ok(query.get('to')?.endsWith('T22:59:59.999Z'));
  });
  await workflow('A verified empty period has an honest empty chart and no decorative status segments',async(page,context)=>{
    fixtureControl.emptyPaths.add('/api/admin/jobs');
    await context.route('**/api/admin/summary*',route=>apiFixture({
      request:()=>route.request(),
      fulfill:payload=>{
        const original=payload.json;
        const json={...original,kpis:Object.fromEntries(Object.entries(original.kpis).map(([key,value])=>[key,typeof value==='number'?0:value])),charts:{...original.charts,statusBreakdown:[],revenueOverTime:[],paymentMethodSplit:[],jobsByDriver:[]}};
        return route.fulfill({...payload,json});
      },
    }));
    await goto(page,'section=overview');
    await page.getByText(/No jobs in this range|No jobs recorded|No job statuses/i).first().waitFor();
    assert.equal(await page.locator('.aurora-donut-segment').count(),0);
  });
  await workflow('Primary summary failure is recoverable and not represented as measured zero',async(page)=>{
    fixtureControl.errorPaths.add('/api/admin/summary');
    await goto(page,'section=overview');
    await page.getByRole('alert').first().waitFor({timeout:18000});
    const text=await page.locator('main').innerText();
    assert.match(text,/could not load|unavailable|couldn.t load|failed/i);
    assert.doesNotMatch(text,/No jobs in this range/);
    fixtureControl.errorPaths.clear();
    const retry=page.getByRole('button',{name:/Try again|Retry/i}).first();
    await retry.click();
    await page.getByRole('heading',{name:/Operations performance/i}).waitFor();
  });
  await workflow('Secondary job-source failure retains supported summary and incomplete coverage',async(page)=>{
    fixtureControl.errorPaths.add('/api/admin/jobs');
    await goto(page,'section=overview');
    await page.getByRole('heading',{name:/Operations performance/i}).waitFor();
    await page.getByRole('alert').first().waitFor({timeout:18000});
    assert.match(await page.locator('main').innerText(),/partial|could not load|unavailable|couldn.t load/i);
  });
}

/**
 * Glass/gradient surfaces cannot be assessed faithfully by ignoring CSS images.
 * This measures the foreground against rendered background pixels with glyphs
 * temporarily made transparent. Ranges provide the real text locations. Normal
 * text requires 4.5:1; large text 3:1. Disabled text is exempt. The five sampled
 * background points are documented, not a formal entire-app accessibility audit.
 */
async function pixelContrast(page,name,theme) {
  const text=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
    return [...document.querySelectorAll('h1,h2,h3,h4,p,span,div,strong,li,dt,dd,figcaption,a,button,td,th,label,summary,small,time,select,text,tspan,input')].flatMap(el=>{
      if(el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"]'))return [];
      // Checkboxes/radios have no visible text; their value defaults to "on".
      // Native picker/clear icons are excluded from input text sample positions.
      if(el instanceof HTMLInputElement&&['checkbox','radio','hidden','range','color'].includes(el.type))return [];
      const style=getComputedStyle(el);
      if(style.display==='none'||style.visibility==='hidden')return [];
      const svg=['text','tspan'].includes(el.tagName.toLowerCase());
      const own=[...el.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
      const label=el instanceof HTMLInputElement?el.value:el instanceof HTMLSelectElement?el.selectedOptions[0]?.textContent:own.map(n=>n.textContent).join('').trim();
      if(!label)return [];
      const boxes=[];
      for(const node of own){const range=document.createRange();range.selectNodeContents(node);boxes.push(...range.getClientRects());}
      if(!boxes.length)boxes.push(el.getBoundingClientRect());
      const rect=boxes.find(rect=>rect.width&&rect.height&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth);
      if(!rect)return [];
      // Text behind a clipped scroll container is not a visible text run.
      const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
      if(!hit||!el.contains(hit)&&!hit.contains(el))return [];
      let opacity=1;for(let node=el;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);
      if(opacity===0)return [];
      const color=svg?style.fill:style.color;
      const foreground=rgb(color);
      if(foreground.length<3)return [];
      const fontSize=parseFloat(style.fontSize),fontWeight=Number(style.fontWeight);
      const positions=el instanceof HTMLInputElement?[.1,.2,.3,.4,.5]:[.1,.3,.5,.7,.9];
      return [{text:label.slice(0,100),fg:foreground,opacity,required:fontSize>=24||fontWeight>=700&&fontSize>=18.66?3:4.5,fontSize,fontWeight,selector:el.tagName.toLowerCase()+'.'+String(el.className?.baseVal??el.className),points:positions.map(value=>[Math.round(rect.left+rect.width*value),Math.round(rect.top+rect.height/2)])}];
    });
  });
  const tempStyle=await page.addStyleTag({content:'body * { color:transparent !important; -webkit-text-fill-color:transparent !important; text-shadow:none !important; } body svg text { fill:transparent !important; }'});
  const filename=path.join(out,`.contrast-${name}-${theme}.png`);
  await page.screenshot({path:filename,fullPage:false});
  await tempStyle.evaluate(el=>el.remove());
  const python=`import json,sys\nfrom PIL import Image\nimage=Image.open(sys.argv[1]).convert('RGB')\nitems=json.load(sys.stdin)\nfor item in items:\n item['backgrounds']=[list(image.getpixel((min(max(x,0),image.width-1),min(max(y,0),image.height-1)))) for x,y in item['points']]\nprint(json.dumps(items))`;
  // execFile's stdin is supplied through the returned child's stream. No shell,
  // command substitution, credentials or arbitrary user-supplied commands.
  const measured=await new Promise((resolve,reject)=>{
    const child=execFile('python3',['-c',python,filename],{maxBuffer:8*1024*1024},(error,stdout)=>error?reject(error):resolve(JSON.parse(stdout)));
    child.stdin.end(JSON.stringify(text));
  });
  await fs.rm(filename,{force:true});
  const luminance=color=>color.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const scored=measured.map(item=>{
    const opacity=item.opacity*(item.fg[3]??1);
    const ratios=item.backgrounds.map(bg=>{
      const fg=item.fg.slice(0,3).map((v,i)=>v*opacity+bg[i]*(1-opacity));
      const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    return {...item,ratio:Math.round(Math.min(...ratios)*100)/100};
  });
  const failures=scored.filter(item=>item.ratio+.01<item.required);
  const result={name,theme,checked:scored.length,minimum:Math.min(...scored.map(item=>item.ratio)),failures,passed:!failures.length};
  console.log(`${result.passed?'PASS':'FAIL'} contrast ${name} ${theme}: ${scored.length} visible text runs, ${failures.length} failures`);
  results.contrast.push(result);
}

async function contrast() {
  for(const theme of themes)for(const view of selectedViews){
    const {context,page}=await themedPage(theme,1366);
    try{
      await loaded(page,view);
      if(process.env.TMV_CONTRAST_SCROLL==='charts'){
        await page.getByRole('heading',{name:'Job activity & trends',exact:true}).scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
      }
      await pixelContrast(page,view.name+(process.env.TMV_CONTRAST_SCROLL==='charts'?'-charts':''),theme);
    }
    catch(error){results.contrast.push({name:view.name,theme,passed:false,error:error.message});console.log(`FAIL contrast ${view.name} ${theme}: ${error.message}`);}
    finally{await context.close();}
  }
}

try {
  if(mode==='all'||mode==='matrix'||mode==='weekly')await matrix();
  if(mode==='all'||mode==='workflows')await workflows();
  if(mode==='all'||mode==='contrast')await contrast();
} finally {
  // Keep a complete review record after an intentional targeted recheck. Fresh
  // full runs replace the corresponding record; changed pairs replace old pairs.
  if(chosen.length||process.env.TMV_WORKFLOW_FILTER||process.env.TMV_WIDTHS||process.env.TMV_THEMES){
    try{
      const previous=JSON.parse(await fs.readFile(path.join(out,`${mode}-results.json`),'utf8'));
      for(const key of ['matrix','workflows','contrast']){
        const current=results[key];
        const identity=item=>`${item.name}|${item.theme??''}|${item.width??''}`;
        const replaced=new Set(current.map(identity));
        results[key]=[...(previous[key]||[]).filter(item=>!replaced.has(identity(item))),...current];
      }
    }catch{ /* First targeted run has no prior record. */ }
  }
  const summary={base,sanitizedFixture:true,method:{contrast:'Five rendered background samples behind each visible text range with glyphs temporarily hidden; includes gradient/glass/background images. WCAG AA thresholds 4.5:1 normal and 3:1 large; disabled controls excluded.',widths,themes},...results,runtimeErrors:errors,interceptedMutations:mutations,unhandledEndpoints:unhandled};
  await fs.writeFile(path.join(out,`${mode}-results.json`),JSON.stringify(summary,null,2));
  await browser.close();
  const failures=[...results.matrix,...results.workflows,...results.contrast].filter(item=>!item.passed);
  if(failures.length||errors.length)process.exitCode=1;
}
