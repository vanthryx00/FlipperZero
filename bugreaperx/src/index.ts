import {
	WorkflowEntrypoint,
	WorkflowEvent,
	WorkflowStep,
} from "cloudflare:workers";
import { createClient, FlipperAIClient } from "./flipper-ai";

/**
 * BugReaperX — Flipper Zero integration Worker.
 *
 *   GET  /?instanceId=<id>  → Workflow instance status
 *   GET  /                  → spawn new Workflow instance
 *   POST /api/flipper-ai/generate-badusb  → LLM-generated BadUSB script
 *   POST /api/flipper-ai/analyze         → LLM payload analysis
 *   POST /api/flipper-ai/generate-ir     → LLM-generated IR signal
 *   POST /api/flipper-ai/generate-subghz → LLM-generated SubGHz RAW file
 *   POST /api/flipper-ai/generate-rfid  → LLM-generated RFID emulation file
 *   POST /api/flipper-ai/generate-nfc   → LLM-generated NFC emulation file
 *   POST /api/flipper-ai/fix             → LLM payload review & fix
 *   POST /api/flipper-ai/chat            → raw LLM prompt
 *   GET  /api/flipper-ai/health          → LLM endpoint health check
 */

// User-defined params passed to your Workflow
type Params = {
	email: string;
	metadata: Record<string, string>;
};

export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const files = await step.do("my first step", async () => {
			return {
				inputParams: event,
				files: [
					"doc_7392_rev3.pdf",
					"report_x29_final.pdf",
					"memo_2024_05_12.pdf",
					"file_089_update.pdf",
					"proj_alpha_v2.pdf",
					"data_analysis_q2.pdf",
					"notes_meeting_52.pdf",
					"summary_fy24_draft.pdf",
				],
			};
		});

		const waitForApproval = await step.waitForEvent("request-approval", {
			type: "approval",
			timeout: "1 minute",
		});

		const apiResponse = await step.do("some other step", async () => {
			let resp = await fetch("https://api.cloudflare.com/client/v4/ips");
			return await resp.json<any>();
		});

		await step.sleep("wait on something", "1 minute");

		await step.do(
			"make a call to write that could maybe, just might, fail",
			{
				retries: {
					limit: 5,
					delay: "5 second",
					backoff: "exponential",
				},
				timeout: "15 minutes",
			},
			async () => {
				if (Math.random() > 0.5) {
					throw new Error("API call to $STORAGE_SYSTEM failed");
				}
			},
		);
	}
}

// ── CORS helper ──────────────────────────────────────────────────────────

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function cors(resp: Response): Response {
	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		resp.headers.set(k, v);
	}
	return resp;
}

// ── Flipper AI route handlers ────────────────────────────────────────────

async function handleGenerateBadUSB(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.description?.trim()) {
		return cors(Response.json({ error: "'description' is required" }, { status: 400 }));
	}
	const result = await client.generateBadUSB({
		description: body.description,
		targetOs: body.target_os || body.targetOs,
		author: body.author,
	});
	return cors(Response.json({ script: result.script, model: result.model }));
}

async function handleAnalyze(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	const content = body.content?.trim();
	if (!content) {
		return cors(Response.json({ error: "'content' is required (the payload file contents)" }, { status: 400 }));
	}
	const result = await client.analyze({
		content,
		filename: body.filename || "payload",
		kind: body.kind,
	});
	return cors(Response.json({ kind: result.kind, analysis: result.analysis, model: result.model }));
}

async function handleGenerateIR(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.description?.trim()) {
		return cors(Response.json({ error: "'description' is required" }, { status: 400 }));
	}
	const result = await client.generateIR({
		description: body.description,
		frequency: body.frequency,
		protocol: body.protocol,
	});
	return cors(Response.json({ ir_content: result.irContent, model: result.model }));
}

async function handleGenerateSubGHz(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.description?.trim()) {
		return cors(Response.json({ error: "'description' is required" }, { status: 400 }));
	}
	const result = await client.generateSubGHz({
		description: body.description,
		frequency: body.frequency,
		preset: body.preset,
	});
	return cors(Response.json({ sub_content: result.subContent, model: result.model }));
}

async function handleGenerateRFID(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.description?.trim()) {
		return cors(Response.json({ error: "'description' is required" }, { status: 400 }));
	}
	const result = await client.generateRFID({
		description: body.description,
		frequency: body.frequency,
		keyType: body.key_type || body.keyType,
	});
	return cors(Response.json({ rfid_content: result.rfidContent, model: result.model }));
}

async function handleGenerateNFC(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.description?.trim()) {
		return cors(Response.json({ error: "'description' is required" }, { status: 400 }));
	}
	const result = await client.generateNFC({
		description: body.description,
		frequency: body.frequency,
		protocol: body.protocol,
		uidSize: body.uid_size || body.uidSize,
	});
	return cors(Response.json({ nfc_content: result.nfcContent, model: result.model }));
}

async function handleFix(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	const content = body.content?.trim();
	if (!content) {
		return cors(Response.json({ error: "'content' is required (the payload file contents)" }, { status: 400 }));
	}
	const result = await client.fix({ content, kind: body.kind });
	return cors(Response.json({
		kind: result.kind,
		fixed_content: result.fixedContent,
		original_chars: result.originalChars,
		model: result.model,
	}));
}

async function handleChat(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.prompt?.trim()) {
		return cors(Response.json({ error: "'prompt' is required" }, { status: 400 }));
	}
	const result = await client.chatPrompt({
		prompt: body.prompt,
		system: body.system,
		maxTokens: body.max_tokens,
		temperature: body.temperature,
	});
	return cors(Response.json({ reply: result.reply, model: result.model }));
}

async function handleChatStream(req: Request, client: FlipperAIClient): Promise<Response> {
	const body = await req.json() as any;
	if (!body.prompt?.trim()) {
		return cors(Response.json({ error: "'prompt' is required" }, { status: 400 }));
	}

	const stream = await client.chatStream(
		body.prompt,
		body.system,
		body.max_tokens ?? 2048,
		body.temperature ?? 0.6,
	);

	return cors(new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
		},
	}));
}

async function handleHealth(client: FlipperAIClient): Promise<Response> {
	try {
		const h = await client.health();
		return cors(Response.json(h));
	} catch (e: any) {
		return cors(Response.json({ ok: false, error: e.message }, { status: 502 }));
	}
}

// ── Main fetch handler ───────────────────────────────────────────────────

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);

		// Favicon — no-op
		if (url.pathname.startsWith("/favicon")) {
			return Response.json({}, { status: 404 });
		}

		// ── Flipper AI API routes ──────────────────────────────────────

		// Handle CORS preflight
		if (url.pathname.startsWith("/api/flipper-ai") && req.method === "OPTIONS") {
			return cors(new Response(null, { status: 204 }));
		}

		if (url.pathname === "/api/flipper-ai/generate-badusb" && req.method === "POST") {
			return handleGenerateBadUSB(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/analyze" && req.method === "POST") {
			return handleAnalyze(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/generate-ir" && req.method === "POST") {
			return handleGenerateIR(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/generate-subghz" && req.method === "POST") {
			return handleGenerateSubGHz(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/generate-rfid" && req.method === "POST") {
			return handleGenerateRFID(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/generate-nfc" && req.method === "POST") {
			return handleGenerateNFC(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/fix" && req.method === "POST") {
			return handleFix(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/chat/stream" && req.method === "POST") {
			return handleChatStream(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/chat" && req.method === "POST") {
			return handleChat(req, createClient(env));
		}
		if (url.pathname === "/api/flipper-ai/health") {
			return handleHealth(createClient(env));
		}
		if (url.pathname.startsWith("/api/flipper-ai")) {
			return cors(Response.json({
				error: "unknown Flipper AI endpoint",
				endpoints: [
					"POST /api/flipper-ai/generate-badusb",
					"POST /api/flipper-ai/analyze",
					"POST /api/flipper-ai/generate-ir",
					"POST /api/flipper-ai/generate-subghz",
					"POST /api/flipper-ai/generate-rfid",
					"POST /api/flipper-ai/generate-nfc",
					"POST /api/flipper-ai/fix",
					"POST /api/flipper-ai/chat",
					"POST /api/flipper-ai/chat/stream  (SSE streaming)",
					"GET  /api/flipper-ai/health",
				],
			}, { status: 404 }));
		}

		// ── Workflow routes ────────────────────────────────────────────

		let id = url.searchParams.get("instanceId");
		if (id) {
			let instance = await env.MY_WORKFLOW.get(id);
			return Response.json({
				status: await instance.status(),
			});
		}

		// Spawn a new instance and return the ID and status
		let instance = await env.MY_WORKFLOW.create();
		return Response.json({
			id: instance.id,
			details: await instance.status(),
		});
	},
};
