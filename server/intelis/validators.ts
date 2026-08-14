export function normalizeCronExpression(value: string) {
  const fields = value.trim().split(/\s+/).filter(Boolean);
  return fields.length === 5 ? ["0", ...fields].join(" ") : fields.join(" ");
}

export function isValidSixFieldCron(value: string) {
  const fields = normalizeCronExpression(value).split(/\s+/);
  return fields.length === 6 && fields.every(field => /^[0-9A-Za-z*/?,\-LW#]+$/.test(field));
}
