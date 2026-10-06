import importlib.util
import io
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from aiohttp import FormData
from aiohttp.test_utils import TestClient, TestServer

transcription = types.ModuleType('tools.transcription_tools')
transcription._extract_transcript_text = Mock()
transcription._resolve_openai_audio_client_config = Mock()
with patch.dict(sys.modules, {'tools.transcription_tools': transcription, 'edge_tts': types.ModuleType('edge_tts')}):
    spec = importlib.util.spec_from_file_location('visit_proxy', Path(__file__).with_name('birokt_voice_proxy.py'))
    proxy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proxy)


class VisitProxyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = TestClient(TestServer(proxy.create_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()

    def form(self):
        form = FormData()
        form.add_field('context', json.dumps({'visitId': 'fixture-visit'}))
        form.add_field('audio', io.BytesIO(b'fixture audio'), filename='visit.m4a', content_type='audio/mp4')
        return form

    async def test_completed_recording_returns_original_transcript_and_no_tts(self):
        created = []
        mkstemp = tempfile.mkstemp
        def track(*args, **kwargs):
            fd, name = mkstemp(*args, **kwargs)
            created.append(Path(name))
            return fd, name
        with patch.object(proxy, '_transcribe', AsyncMock(return_value='Egg i kube 1.')), patch.object(proxy, '_ask_hermes_visit', Mock(return_value=json.dumps({'summary': 'Egg observert.', 'entries': []}))) as hermes, patch.object(proxy, '_tts_base64', AsyncMock()) as tts, patch.object(proxy.tempfile, 'mkstemp', track):
            response = await self.client.post('/visits/process', data=self.form())
            self.assertEqual(response.status, 200)
            data = await response.json()
            self.assertEqual(data['transcript'], 'Egg i kube 1.')
            self.assertNotIn('replyAudioBase64', data)
            self.assertIn('IKKE skriv', hermes.call_args.args[0])
            tts.assert_not_called()
        self.assertTrue(created)
        self.assertTrue(all(not p.exists() for p in created))

    async def test_invalid_hermes_output_is_an_error_not_an_empty_visit(self):
        with patch.object(proxy, '_transcribe', AsyncMock(return_value='Kube 1.')), patch.object(proxy, '_ask_hermes_visit', Mock(return_value='not json')):
            response = await self.client.post('/visits/process', data=self.form())
            self.assertEqual(response.status, 502)
            self.assertNotIn('entries', await response.json())

    async def test_empty_transcription_does_not_call_hermes(self):
        with patch.object(proxy, '_transcribe', AsyncMock(return_value='')), patch.object(proxy, '_ask_hermes_visit', Mock()) as hermes:
            response = await self.client.post('/visits/process', data=self.form())
            self.assertEqual(response.status, 422)
            hermes.assert_not_called()

    def test_hermes_uses_no_execution_tools_and_fails_closed_if_tools_are_loaded(self):
        agent_module = types.ModuleType('run_agent')
        agent = Mock(tools=[])
        agent.run_conversation.return_value = {'final_response': '{"summary":"test","entries":[]}'}
        agent_module.AIAgent = Mock(return_value=agent)
        gateway = types.ModuleType('gateway.run')
        gateway._resolve_gateway_model = Mock(return_value='configured-cloud-model')
        gateway._resolve_runtime_agent_kwargs = Mock(return_value={})
        gateway.GatewayRunner = Mock()
        gateway.GatewayRunner._load_fallback_model.return_value = None
        with patch.dict(sys.modules, {'run_agent': agent_module, 'gateway.run': gateway}):
            proxy._ask_hermes_visit('fixture', 'fixture-session')
            self.assertEqual(agent_module.AIAgent.call_args.kwargs['enabled_toolsets'], [])
            agent.tools = ['unexpected-write-tool']
            with self.assertRaises(RuntimeError): proxy._ask_hermes_visit('fixture', 'fixture-session')


if __name__ == '__main__':
    unittest.main()
