// 画面どうしで使う小さな取り出し。
/** その予定の、今日以降で一番近い申し込み・期限。 */
export const nextDeadlineOf = (e, today) => e.dates.find((d) => d.date >= today) || null;
