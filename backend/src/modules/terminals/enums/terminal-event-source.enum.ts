/**
 * Terminal eventlari serverga qanday yetib keladi:
 *  PUSH    — terminal o‘zi HTTP Push bilan yuboradi (tavsiya etiladi);
 *  POLLING — server terminaldan ISAPI orqali davriy so‘raydi
 *            (Push’ni qo‘llamaydigan modellar uchun).
 */
export enum TerminalEventSource {
  PUSH = 'PUSH',
  POLLING = 'POLLING',
}
