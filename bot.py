import os
from dotenv import load_dotenv

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# ===== LOAD CONFIG DARI .env =====
load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN belum di-set di .env")

admin_ids_env = os.getenv("ADMIN_IDS", "")
ADMIN_IDS = set()
for part in admin_ids_env.replace(" ", "").split(","):
    if part:
        try:
            ADMIN_IDS.add(int(part))
        except ValueError:
            pass  # abaikan yang bukan angka


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ===== DATA SEMENTARA (in-memory) =====
# Nanti bisa kamu ganti ke database / file / Google Sheets.

TOKENS = [
    {"username": "", "email": "user1@example.com", "token": "123456:ABCDEF"},
    {"username": "@budi", "email": "budi@example.com", "token": "987654:ZYXWVU"},
]

# BOTS: key = nama kategori (pin/haven/june/dst)
BOTS = {
    "pin": [
        {"lokasi_vps": "SG-1", "username": "", "token": "111111:PINPIN"},
        {"lokasi_vps": "ID-2", "username": "@botpinid", "token": "222222:PINPIN"},
    ],
    "haven": [],
    "june": [],
}


# ===== KEYBOARD / TOMBOL =====

def main_menu_keyboard():
    keyboard = [
        [InlineKeyboardButton("List Token", callback_data="menu:list_token")],
        [InlineKeyboardButton("Daftar Bot", callback_data="menu:daftar_bot")],
    ]
    return InlineKeyboardMarkup(keyboard)


def list_token_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("Tambah", callback_data="token:add"),
            InlineKeyboardButton("Edit", callback_data="token:edit"),
        ],
        [
            InlineKeyboardButton("Hapus", callback_data="token:delete"),
            InlineKeyboardButton("Kembali", callback_data="menu:main"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def daftar_bot_keyboard():
    rows = []
    # tombol untuk tiap kategori (dynamic)
    for name in BOTS.keys():
        rows.append([InlineKeyboardButton(name, callback_data=f"botcat:open:{name}")])

    # tombol CRUD kategori
    rows.append([
        InlineKeyboardButton("Tambah", callback_data="botcat:add"),
        InlineKeyboardButton("Edit", callback_data="botcat:edit"),
    ])
    rows.append([
        InlineKeyboardButton("Hapus", callback_data="botcat:delete"),
        InlineKeyboardButton("Kembali", callback_data="menu:main"),
    ])

    return InlineKeyboardMarkup(rows)


def list_bot_category_keyboard(category: str):
    keyboard = [
        [
            InlineKeyboardButton("Tambah", callback_data=f"botitem:{category}:add"),
            InlineKeyboardButton("Edit", callback_data=f"botitem:{category}:edit"),
        ],
        [
            InlineKeyboardButton("Hapus", callback_data=f"botitem:{category}:delete"),
            InlineKeyboardButton("Kembali", callback_data="menu:daftar_bot"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# ===== TEKS TAMPILAN =====

def build_list_token_text() -> str:
    if not TOKENS:
        return "🔐 <b>List Token</b>\n\nBelum ada data token."

    lines = ["🔐 <b>List Token</b>\n"]
    for i, item in enumerate(TOKENS, start=1):
        username = item.get("username") or "(kosong)"
        email = item.get("email") or "(kosong)"
        token = item.get("token") or "(kosong)"
        lines.append(
            f"{i}. \n"
            f"username: {username}\n"
            f"email: {email}\n"
            f"token: <code>{token}</code>\n"
        )
    return "\n".join(lines)


def build_daftar_bot_text() -> str:
    if not BOTS:
        return "🤖 <b>Daftar Bot</b>\n\nBelum ada kategori bot."

    lines = ["🤖 <b>Daftar Bot</b>\n"]
    for i, name in enumerate(BOTS.keys(), start=1):
        lines.append(f"{i}. {name}")
    lines.append("\nKlik nama di tombol bawah untuk membuka kategori.")
    return "\n".join(lines)


def build_list_bot_category_text(category: str) -> str:
    data = BOTS.get(category, [])
    title = category
    if not data:
        return f"🤖 <b>List Bot {title}</b>\n\nBelum ada data bot."

    lines = [f"🤖 <b>List Bot {title}</b>\n"]
    for i, item in enumerate(data, start=1):
        lokasi = item.get("lokasi_vps") or "(kosong)"
        username = item.get("username") or "(kosong)"
        token = item.get("token") or "(kosong)"
        lines.append(
            f"{i}. \n"
            f"lokasi vps: {lokasi}\n"
            f"username: {username}\n"
            f"token: <code>{token}</code>\n"
        )
    return "\n".join(lines)


# ===== HANDLER =====

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if update.message:
        await update.message.reply_text(
            "🧩 <b>Menu Utama</b>\nSilakan pilih menu:",
            reply_markup=main_menu_keyboard(),
            parse_mode="HTML",
        )
        # info untuk bantu ambil user_id admin pertama kali
        await update.message.reply_text(
            f"user_id kamu: <code>{user.id}</code>\n"
            f"(tambahkan ke ADMIN_IDS di .env)",
            parse_mode="HTML",
        )


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data
    user_id = update.effective_user.id
    await query.answer()

    # ------ MENU UTAMA ------
    if data == "menu:main":
        await query.edit_message_text(
            "🧩 <b>Menu Utama</b>\nSilakan pilih menu:",
            reply_markup=main_menu_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ------ LIST TOKEN ------
    if data == "menu:list_token":
        text = build_list_token_text()
        await query.edit_message_text(
            text,
            reply_markup=list_token_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    if data == "token:add":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh tambah token.", parse_mode="HTML"
            )
            return
        context.user_data["mode"] = "adding_token"
        await query.edit_message_text(
            "➕ <b>Tambah Token</b>\n\n"
            "Kirim data dengan format:\n"
            "<code>email;token;[username optional]</code>\n\n"
            "Contoh:\n"
            "<code>user1@example.com;123456:ABCDEF;@username</code>",
            parse_mode="HTML",
        )
        return

    if data == "token:edit":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh edit token.", parse_mode="HTML"
            )
            return
        text = build_list_token_text()
        await query.edit_message_text(
            text
            + "\n\n✏️ Kirim nomor token yang mau di-edit.\n"
              "Contoh: <code>2</code>",
            parse_mode="HTML",
        )
        context.user_data["mode"] = "editing_token_select"
        return

    if data == "token:delete":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh hapus token.", parse_mode="HTML"
            )
            return
        text = build_list_token_text()
        await query.edit_message_text(
            text
            + "\n\n🗑 Kirim nomor token yang mau dihapus.\n"
              "Contoh: <code>1</code>",
            parse_mode="HTML",
        )
        context.user_data["mode"] = "deleting_token_select"
        return

    # ------ DAFTAR BOT (KATEGORI) ------
    if data == "menu:daftar_bot":
        text = build_daftar_bot_text()
        await query.edit_message_text(
            text,
            reply_markup=daftar_bot_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    if data.startswith("botcat:open:"):
        category = data.split(":", 2)[2]
        text = build_list_bot_category_text(category)
        await query.edit_message_text(
            text,
            reply_markup=list_bot_category_keyboard(category),
            parse_mode="HTML",
        )
        context.user_data["bot_category"] = category
        return

    if data == "botcat:add":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh tambah kategori bot.",
                parse_mode="HTML",
            )
            return
        context.user_data["mode"] = "adding_bot_category"
        await query.edit_message_text(
            "➕ <b>Tambah Kategori Bot</b>\n\n"
            "Kirim nama kategori, contoh: <code>pin</code>",
            parse_mode="HTML",
        )
        return

    if data == "botcat:edit":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh edit kategori bot.",
                parse_mode="HTML",
            )
            return
        text = build_daftar_bot_text()
        await query.edit_message_text(
            text
            + "\n\n✏️ Kirim format: <code>nomor;nama_baru</code>\n"
              "Contoh: <code>1;pin-baru</code>",
            parse_mode="HTML",
        )
        context.user_data["mode"] = "editing_bot_category_select"
        return

    if data == "botcat:delete":
        if not is_admin(user_id):
            await query.edit_message_text(
                "❌ Hanya admin yang boleh hapus kategori bot.",
                parse_mode="HTML",
            )
            return
        text = build_daftar_bot_text()
        await query.edit_message_text(
            text
            + "\n\n🗑 Kirim nomor kategori yang mau dihapus.\n"
              "Contoh: <code>2</code>",
            parse_mode="HTML",
        )
        context.user_data["mode"] = "deleting_bot_category_select"
        return

    # ------ DALAM KATEGORI (ITEM BOT) ------
    if data.startswith("botitem:"):
        # contoh: botitem:pin:add
        _, category, action = data.split(":", 2)
        if action == "add":
            if not is_admin(user_id):
                await query.edit_message_text(
                    "❌ Hanya admin yang boleh tambah bot.",
                    parse_mode="HTML",
                )
                return
            context.user_data["mode"] = "adding_bot_item"
            context.user_data["bot_category"] = category
            await query.edit_message_text(
                f"➕ <b>Tambah Bot {category}</b>\n\n"
                "Kirim data dengan format:\n"
                "<code>lokasi_vps;token;[username optional]</code>\n\n"
                "Contoh:\n"
                "<code>SG-1;123456:ABCDEF;@botpin</code>",
                parse_mode="HTML",
            )
            return
        elif action == "edit":
            if not is_admin(user_id):
                await query.edit_message_text(
                    "❌ Hanya admin yang boleh edit bot.",
                    parse_mode="HTML",
                )
                return
            text = build_list_bot_category_text(category)
            await query.edit_message_text(
                text
                + "\n\n✏️ Kirim format:\n"
                  "<code>nomor;lokasi_vps;token;[username optional]</code>\n"
                  "Contoh:\n"
                  "<code>1;SG-2;999999:NEWTOKEN;@usernamebaru</code>",
                parse_mode="HTML",
            )
            context.user_data["mode"] = "editing_bot_item_input"
            context.user_data["bot_category"] = category
            return
        elif action == "delete":
            if not is_admin(user_id):
                await query.edit_message_text(
                    "❌ Hanya admin yang boleh hapus bot.",
                    parse_mode="HTML",
                )
                return
            text = build_list_bot_category_text(category)
            await query.edit_message_text(
                text
                + "\n\n🗑 Kirim nomor bot yang mau dihapus.\n"
                  "Contoh: <code>1</code>",
                parse_mode="HTML",
            )
            context.user_data["mode"] = "deleting_bot_item_select"
            context.user_data["bot_category"] = category
            return


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    mode = context.user_data.get("mode")
    user_id = update.effective_user.id
    text = update.message.text.strip()

    # ===== TAMBAH TOKEN =====
    if mode == "adding_token":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh tambah token.", parse_mode="HTML"
            )
            return

        parts = [p.strip() for p in text.split(";", maxsplit=2)]

        if len(parts) < 2:
            await update.message.reply_text(
                "Format salah.\n"
                "Gunakan: <code>email;token;[username]</code>",
                parse_mode="HTML",
            )
            return

        email = parts[0]
        token = parts[1]
        username = parts[2] if len(parts) == 3 else ""

        TOKENS.append({"username": username, "email": email, "token": token})

        await update.message.reply_text(
            "✅ Token baru ditambahkan.\n\n" + build_list_token_text(),
            reply_markup=list_token_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== EDIT TOKEN (PILIH NOMOR) =====
    if mode == "editing_token_select":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh edit token.", parse_mode="HTML"
            )
            return

        try:
            idx = int(text)
        except ValueError:
            await update.message.reply_text(
                "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
                parse_mode="HTML",
            )
            return

        if idx < 1 or idx > len(TOKENS):
            await update.message.reply_text(
                "Nomor di luar range.",
                parse_mode="HTML",
            )
            return

        context.user_data["mode"] = "editing_token_input"
        context.user_data["edit_index"] = idx - 1
        item = TOKENS[idx - 1]
        await update.message.reply_text(
            "Data saat ini:\n"
            f"username: {item.get('username') or '(kosong)'}\n"
            f"email: {item.get('email') or '(kosong)'}\n"
            f"token: <code>{item.get('token') or '(kosong)'}</code>\n\n"
            "Kirim data baru dengan format:\n"
            "<code>email;token;[username optional]</code>",
            parse_mode="HTML",
        )
        return

    # ===== EDIT TOKEN (INPUT BARU) =====
    if mode == "editing_token_input":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh edit token.", parse_mode="HTML"
            )
            return

        edit_index = context.user_data.get("edit_index")
        if edit_index is None or edit_index >= len(TOKENS):
            await update.message.reply_text(
                "Index token tidak ditemukan.",
                parse_mode="HTML",
            )
            context.user_data.clear()
            return

        parts = [p.strip() for p in text.split(";", maxsplit=2)]

        if len(parts) < 2:
            await update.message.reply_text(
                "Format salah.\n"
                "Gunakan: <code>email;token;[username]</code>",
                parse_mode="HTML",
            )
            return

        email = parts[0]
        token = parts[1]
        username = parts[2] if len(parts) == 3 else ""

        TOKENS[edit_index] = {
            "username": username,
            "email": email,
            "token": token,
        }

        await update.message.reply_text(
            "✅ Token berhasil di-update.\n\n" + build_list_token_text(),
            reply_markup=list_token_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== HAPUS TOKEN =====
    if mode == "deleting_token_select":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh hapus token.", parse_mode="HTML"
            )
            return

        try:
            idx = int(text)
        except ValueError:
            await update.message.reply_text(
                "Nomor tidak valid. Kirim angka saja, contoh: <code>1</code>",
                parse_mode="HTML",
            )
            return

        if idx < 1 or idx > len(TOKENS):
            await update.message.reply_text(
                "Nomor di luar range.",
                parse_mode="HTML",
            )
            return

        deleted = TOKENS.pop(idx - 1)
        await update.message.reply_text(
            "✅ Token berikut telah dihapus:\n"
            f"email: {deleted.get('email')}\n"
            f"token: <code>{deleted.get('token')}</code>\n\n"
            + build_list_token_text(),
            reply_markup=list_token_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== TAMBAH KATEGORI BOT =====
    if mode == "adding_bot_category":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh tambah kategori bot.",
                parse_mode="HTML",
            )
            return

        name = text
        if not name:
            await update.message.reply_text("Nama kategori tidak boleh kosong.")
            return
        if name in BOTS:
            await update.message.reply_text("Nama kategori sudah ada.")
            return

        BOTS[name] = []
        msg = build_daftar_bot_text()
        await update.message.reply_text(
            "✅ Kategori bot baru ditambahkan.\n\n" + msg,
            reply_markup=daftar_bot_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== EDIT KATEGORI BOT (nomor;nama_baru) =====
    if mode == "editing_bot_category_select":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh edit kategori bot.",
                parse_mode="HTML",
            )
            return

        parts = [p.strip() for p in text.split(";", maxsplit=1)]
        if len(parts) != 2:
            await update.message.reply_text(
                "Format salah.\n"
                "Gunakan: <code>nomor;nama_baru</code>",
                parse_mode="HTML",
            )
            return

        try:
            idx = int(parts[0])
        except ValueError:
            await update.message.reply_text(
                "Nomor tidak valid.",
                parse_mode="HTML",
            )
            return

        new_name = parts[1]
        if not new_name:
            await update.message.reply_text("Nama baru tidak boleh kosong.")
            return

        names = list(BOTS.keys())
        if idx < 1 or idx > len(names):
            await update.message.reply_text("Nomor di luar range.")
            return

        old_name = names[idx - 1]
        if new_name in BOTS and new_name != old_name:
            await update.message.reply_text(
                "Nama kategori baru sudah dipakai.",
                parse_mode="HTML",
            )
            return

        # rename key dict
        BOTS[new_name] = BOTS.pop(old_name)

        msg = build_daftar_bot_text()
        await update.message.reply_text(
            f"✅ Kategori '{old_name}' di-rename jadi '{new_name}'.\n\n" + msg,
            reply_markup=daftar_bot_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== HAPUS KATEGORI BOT =====
    if mode == "deleting_bot_category_select":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh hapus kategori bot.",
                parse_mode="HTML",
            )
            return

        try:
            idx = int(text)
        except ValueError:
            await update.message.reply_text(
                "Nomor tidak valid.",
                parse_mode="HTML",
            )
            return

        names = list(BOTS.keys())
        if idx < 1 or idx > len(names):
            await update.message.reply_text("Nomor di luar range.")
            return

        name = names[idx - 1]
        deleted = BOTS.pop(name)

        msg = build_daftar_bot_text()
        await update.message.reply_text(
            f"✅ Kategori '{name}' telah dihapus.\n"
            f"Jumlah bot di dalam kategori tadi: {len(deleted)}\n\n"
            + msg,
            reply_markup=daftar_bot_keyboard(),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== TAMBAH ITEM BOT DI KATEGORI =====
    if mode == "adding_bot_item":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh tambah bot.",
                parse_mode="HTML",
            )
            return

        category = context.user_data.get("bot_category")
        if not category or category not in BOTS:
            await update.message.reply_text("Kategori bot tidak ditemukan.")
            context.user_data.clear()
            return

        parts = [p.strip() for p in text.split(";", maxsplit=2)]
        if len(parts) < 2:
            await update.message.reply_text(
                "Format salah.\n"
                "Gunakan: <code>lokasi_vps;token;[username]</code>",
                parse_mode="HTML",
            )
            return

        lokasi_vps = parts[0]
        token = parts[1]
        username = parts[2] if len(parts) == 3 else ""

        BOTS[category].append(
            {"lokasi_vps": lokasi_vps, "username": username, "token": token}
        )

        msg = build_list_bot_category_text(category)
        await update.message.reply_text(
            f"✅ Bot baru di kategori {category} ditambahkan.\n\n"
            + msg,
            reply_markup=list_bot_category_keyboard(category),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== EDIT ITEM BOT (nomor;lokasi_vps;token;[username]) =====
    if mode == "editing_bot_item_input":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh edit bot.",
                parse_mode="HTML",
            )
            return

        category = context.user_data.get("bot_category")
        if not category or category not in BOTS:
            await update.message.reply_text("Kategori bot tidak ditemukan.")
            context.user_data.clear()
            return

        parts = [p.strip() for p in text.split(";", maxsplit=3)]
        if len(parts) < 3:
            await update.message.reply_text(
                "Format salah.\n"
                "Gunakan: <code>nomor;lokasi_vps;token;[username]</code>",
                parse_mode="HTML",
            )
            return

        try:
            idx = int(parts[0])
        except ValueError:
            await update.message.reply_text("Nomor tidak valid.", parse_mode="HTML")
            return

        data_list = BOTS[category]
        if idx < 1 or idx > len(data_list):
            await update.message.reply_text("Nomor di luar range.", parse_mode="HTML")
            return

        lokasi_vps = parts[1]
        token = parts[2]
        username = parts[3] if len(parts) == 4 else ""

        data_list[idx - 1] = {
            "lokasi_vps": lokasi_vps,
            "username": username,
            "token": token,
        }

        msg = build_list_bot_category_text(category)
        await update.message.reply_text(
            "✅ Data bot berhasil di-update.\n\n" + msg,
            reply_markup=list_bot_category_keyboard(category),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== HAPUS ITEM BOT (nomor) =====
    if mode == "deleting_bot_item_select":
        if not is_admin(user_id):
            await update.message.reply_text(
                "❌ Hanya admin yang boleh hapus bot.",
                parse_mode="HTML",
            )
            return

        category = context.user_data.get("bot_category")
        if not category or category not in BOTS:
            await update.message.reply_text("Kategori bot tidak ditemukan.")
            context.user_data.clear()
            return

        try:
            idx = int(text)
        except ValueError:
            await update.message.reply_text("Nomor tidak valid.", parse_mode="HTML")
            return

        data_list = BOTS[category]
        if idx < 1 or idx > len(data_list):
            await update.message.reply_text("Nomor di luar range.", parse_mode="HTML")
            return

        deleted = data_list.pop(idx - 1)

        msg = build_list_bot_category_text(category)
        await update.message.reply_text(
            "✅ Bot berikut telah dihapus:\n"
            f"lokasi vps: {deleted.get('lokasi_vps')}\n"
            f"username: {deleted.get('username') or '(kosong)'}\n"
            f"token: <code>{deleted.get('token')}</code>\n\n"
            + msg,
            reply_markup=list_bot_category_keyboard(category),
            parse_mode="HTML",
        )
        context.user_data.clear()
        return

    # ===== BUKAN MODE APA-APA =====
    await update.message.reply_text(
        "Kalau mau mulai, pakai /start dulu ya 😉",
        parse_mode="HTML",
    )


async def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    await app.run_polling()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
