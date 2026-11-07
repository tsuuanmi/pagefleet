import { randomUUID } from 'node:crypto';
import { variantPrompt, freeDraft, apiError } from './logic.mjs';

function price(provider) {
  const prefix=provider==='openai'?'OPENAI':'ANTHROPIC';
  const i=Number(process.env[prefix+'_INPUT_USD_PER_M']);
  const o=Number(process.env[prefix+'_OUTPUT_USD_PER_M']);
  if(!Number.isFinite(i)||!Number.isFinite(o)||i<=0||o<=0)throw apiError('Set valid '+prefix+' input/output prices per million tokens before paid generation',409);
  return {input:i,output:o};
}
function timeoutSignal() { return AbortSignal.timeout(30_000); }
async function jsonResponse(response) {
  const text=await response.text();
  let data;try{data=JSON.parse(text);}catch{throw apiError('Provider returned invalid JSON',502);}
  if(!response.ok)throw apiError('Provider HTTP '+response.status+': '+String(data?.error?.message||'request rejected').slice(0,250),502);
  return data;
}
export async function generate(v,provider) {
  const prompt=variantPrompt(v,v);
  if(provider==='template')return {text:freeDraft(v,v),provider:'template',model:'template',inputTokens:0,outputTokens:0,cost:0};
  const rate=price(provider);
  const prefix=provider==='openai'?'OPENAI':'ANTHROPIC';
  const key=process.env[prefix+'_API_KEY'];
  if(!key)throw apiError('Missing '+prefix+' API key',409);
  const model=process.env[prefix+'_MODEL'];
  if(!model)throw apiError('Missing '+prefix+' model name',409);
  // Conservative preflight estimates; requests are serialized by the server.
  const potential=(((Math.ceil(prompt.length/2)+1000)*rate.input)+((1200)*rate.output))/1_000_000;
  let data,text,inputTokens,outputTokens;
  if(provider==='openai') {
    const resp=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',signal:timeoutSignal(),
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
      body:JSON.stringify({model,input:prompt,max_output_tokens:900,store:false})
    });
    data=await jsonResponse(resp);
    text=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    inputTokens=data.usage?.input_tokens??0;outputTokens=data.usage?.output_tokens??0;
  } else if(provider==='anthropic') {
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',signal:timeoutSignal(),
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model,max_tokens:900,messages:[{role:'user',content:prompt}]})
    });
    data=await jsonResponse(resp);
    text=(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();
    inputTokens=data.usage?.input_tokens??0;outputTokens=data.usage?.output_tokens??0;
  } else throw apiError('Unknown AI provider');
  if(!text || text.length>5000)throw apiError('Provider returned empty or oversized content',502);
  return {text,provider,model,inputTokens,outputTokens,cost:(inputTokens*rate.input+outputTokens*rate.output)/1_000_000,potential};
}
export function preflightGeneration(provider) {
  if(!['template','openai','anthropic'].includes(provider))throw apiError('Unknown AI provider');
  if(provider==='template')return 0;
  const rate=price(provider);
  return (3500*rate.input+1200*rate.output)/1_000_000;
}
/** Mock publisher: records a fake remote ID; nothing is sent to Facebook. */
export function mockSchedule() {
  return { remoteId: 'mock-' + randomUUID(), state: 'scheduled' };
}
