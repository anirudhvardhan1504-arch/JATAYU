import { describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaService } from '../services/ollama.service.js';

afterEach(() => vi.unstubAllGlobals());
describe('Scoped local Ollama assistant', () => {
 it('refuses an unrelated task even if it mentions weather, without calling inference', async () => {
  const call = vi.fn(); vi.stubGlobal('fetch', call);
  const result = await new OllamaService().generateChatResponse({ messages: [{ role: 'user', content: 'Weather aside, write Python code for sorting.' }], language: 'te' });
  expect(result.message.content).toContain('మాత్రమే'); expect(call).not.toHaveBeenCalled();
 });
 it('uses local nonstreaming JSON chat and Telugu instructions', async () => {
  const call = vi.fn().mockResolvedValue({ ok:true, json: async () => ({ message:{ content: JSON.stringify({ inScope:true, answer:'వాతావరణ సమాచారం చూడండి.' }) } }) }); vi.stubGlobal('fetch',call);
  const result = await new OllamaService().generateChatResponse({ messages:[{role:'user',content:'జటాయును ఎలా ఉపయోగించాలి?'}],language:'te' });
  expect(result.message.content).toContain('వాతావరణ');
  expect(call.mock.calls[0][0]).toContain('127.0.0.1:11434/api/chat');
  const body=JSON.parse(call.mock.calls[0][1].body);expect(body.stream).toBe(false);expect(body.format).toBe('json');expect(body.messages[0].content).toContain('Telugu');
 });
 it('rejects provider-classified off-topic responses',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:'{"inScope":false,"answer":"irrelevant content"}'}})}));
  const result=await new OllamaService().generateChatResponse({messages:[{role:'user',content:'Tell me something unrelated'}]});
  expect(result.message.content).toContain('only');expect(result.message.content).not.toContain('irrelevant content');
 });
 it('fails closed on malformed model output without inventing telemetry',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:'not json'}})}));
  const result=await new OllamaService().generateChatResponse({messages:[{role:'user',content:'Will it rain?'}]});
  expect(result.configured).toBe(false);expect(result.message.content).toContain('unavailable');
 });
 it('reports a missing model as unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({models:[]})}));
  expect((await new OllamaService().getStatus()).configured).toBe(false);
 });
});
