import { randomWhatsAppNumber } from "@/data/products";

export function WhatsAppFloat() {
  const handleClick = () => {
    const text = encodeURIComponent("Hi Moments Packaging, I'd like to enquire about your packaging.");
    // Picked fresh on every click (not once per page load) so repeat
    // visitors don't all keep landing on the same line.
    const href = `https://wa.me/${randomWhatsAppNumber()}?text=${text}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-4 left-4 z-50 hidden min-h-[48px] items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-medium text-white shadow-lg shadow-black/20 transition-all hover:scale-105 hover:shadow-xl sm:bottom-6 sm:left-6 sm:px-5 sm:py-3.5 md:flex"
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M16.003 3C9.374 3 4 8.373 4 14.999c0 2.317.65 4.487 1.776 6.345L4 29l7.86-1.747a11.95 11.95 0 0 0 4.143.74h.005C22.633 27.993 28 22.62 28 15.994 28 8.373 22.625 3 16.003 3zm0 21.78h-.004a9.81 9.81 0 0 1-3.998-.873l-.286-.13-4.665 1.038 1.06-4.55-.187-.296a9.79 9.79 0 0 1-1.503-5.18c0-5.41 4.404-9.812 9.819-9.812 2.622 0 5.085 1.022 6.937 2.875a9.74 9.74 0 0 1 2.873 6.943c-.003 5.41-4.408 9.811-9.823 9.811z" />
        <path d="M21.4 17.55c-.295-.148-1.745-.86-2.014-.957-.27-.099-.467-.148-.664.148-.197.296-.762.957-.934 1.154-.172.197-.345.222-.64.074-.295-.148-1.246-.459-2.373-1.464-.877-.782-1.47-1.748-1.642-2.044-.172-.296-.018-.456.13-.604.133-.132.295-.345.443-.518.148-.172.197-.295.295-.493.099-.197.05-.37-.025-.518-.074-.148-.664-1.6-.91-2.193-.24-.575-.484-.497-.664-.506l-.566-.01c-.197 0-.518.074-.79.37-.27.295-1.034 1.01-1.034 2.46 0 1.45 1.058 2.852 1.206 3.05.148.197 2.083 3.182 5.05 4.46.706.305 1.256.487 1.685.624.708.225 1.353.193 1.862.118.568-.085 1.745-.713 1.992-1.402.246-.69.246-1.28.172-1.402-.074-.123-.27-.197-.566-.345z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp Us</span>
    </button>
  );
}
