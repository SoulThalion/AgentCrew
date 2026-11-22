# Lee y descifra cursorAuth/accessToken (Windows). Salida: JWT en una línea.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CursorToken {
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr vfs);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_close(IntPtr db);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int n, out IntPtr stmt, IntPtr tail);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_bind_text(IntPtr stmt, int i, byte[] val, int n, IntPtr destructor);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_step(IntPtr stmt);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern IntPtr sqlite3_column_text(IntPtr stmt, int i);
  [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
  static extern int sqlite3_finalize(IntPtr stmt);
  [StructLayout(LayoutKind.Sequential)]
  struct DATA_BLOB { public int cbData; public IntPtr pbData; }
  [DllImport("crypt32.dll", SetLastError = true)]
  static extern bool CryptUnprotectData(ref DATA_BLOB i, IntPtr d, IntPtr e, IntPtr r, IntPtr p, int f, ref DATA_BLOB o);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
  [DllImport("bcrypt.dll")] static extern int BCryptOpenAlgorithmProvider(out IntPtr h, [MarshalAs(UnmanagedType.LPWStr)] string a, IntPtr i, int f);
  [DllImport("bcrypt.dll")] static extern int BCryptSetProperty(IntPtr h, [MarshalAs(UnmanagedType.LPWStr)] string p, byte[] v, int l, int f);
  [DllImport("bcrypt.dll")] static extern int BCryptGenerateSymmetricKey(IntPtr a, out IntPtr k, IntPtr kb, int kbl, byte[] s, int sl, int f);
  [DllImport("bcrypt.dll")] static extern int BCryptDecrypt(IntPtr k, byte[] i, int il, ref BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO info, byte[] iv, int ivl, byte[] o, int ol, out int r, int f);
  [DllImport("bcrypt.dll")] static extern int BCryptDestroyKey(IntPtr k);
  [DllImport("bcrypt.dll")] static extern int BCryptCloseAlgorithmProvider(IntPtr h, int f);
  [StructLayout(LayoutKind.Sequential)]
  struct BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO {
    public int cbSize; public int dwInfoVersion; public IntPtr pbNonce; public int cbNonce;
    public IntPtr pbAuthData; public int cbAuthData; public IntPtr pbTag; public int cbTag;
    public IntPtr pbMacContext; public int cbMacContext; public int cbAAD; public long cbData; public int dwFlags;
  }
  static byte[] Utf8Z(string s) { return Encoding.UTF8.GetBytes(s + "\0"); }
  static byte[] Unprotect(byte[] data) {
    DATA_BLOB input = new DATA_BLOB();
    input.pbData = Marshal.AllocHGlobal(data.Length);
    Marshal.Copy(data, 0, input.pbData, data.Length);
    input.cbData = data.Length;
    DATA_BLOB output = new DATA_BLOB();
    try {
      if (!CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0, ref output))
        throw new System.ComponentModel.Win32Exception();
      byte[] res = new byte[output.cbData];
      Marshal.Copy(output.pbData, res, 0, output.cbData);
      LocalFree(output.pbData);
      return res;
    } finally { Marshal.FreeHGlobal(input.pbData); }
  }
  static string AesGcmDecrypt(byte[] key, byte[] nonce, byte[] ct, byte[] tag) {
    IntPtr alg, hkey;
    if (BCryptOpenAlgorithmProvider(out alg, "AES", IntPtr.Zero, 0) != 0) throw new Exception("BCryptOpen");
    try {
      byte[] chain = Encoding.Unicode.GetBytes("ChainingModeGCM\0");
      if (BCryptSetProperty(alg, "ChainingMode", chain, chain.Length, 0) != 0) throw new Exception("GCM");
      if (BCryptGenerateSymmetricKey(alg, out hkey, IntPtr.Zero, 0, key, key.Length, 0) != 0) throw new Exception("key");
      try {
        BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO info = new BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO();
        info.cbSize = Marshal.SizeOf(typeof(BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO));
        info.dwInfoVersion = 1;
        IntPtr pNonce = Marshal.AllocHGlobal(nonce.Length);
        IntPtr pTag = Marshal.AllocHGlobal(tag.Length);
        try {
          Marshal.Copy(nonce, 0, pNonce, nonce.Length);
          Marshal.Copy(tag, 0, pTag, tag.Length);
          info.pbNonce = pNonce; info.cbNonce = nonce.Length;
          info.pbTag = pTag; info.cbTag = tag.Length;
          byte[] output = new byte[ct.Length];
          int written;
          int st = BCryptDecrypt(hkey, ct, ct.Length, ref info, null, 0, output, output.Length, out written, 0);
          if (st != 0) throw new Exception("decrypt " + st);
          return Encoding.UTF8.GetString(output, 0, written);
        } finally { Marshal.FreeHGlobal(pNonce); Marshal.FreeHGlobal(pTag); }
      } finally { BCryptDestroyKey(hkey); }
    } finally { BCryptCloseAlgorithmProvider(alg, 0); }
  }
  public static string Read(string dbPath, string localStatePath) {
    IntPtr db;
    if (sqlite3_open_v2(Utf8Z(dbPath), out db, 1, IntPtr.Zero) != 0) return "";
    try {
      IntPtr stmt;
      if (sqlite3_prepare_v2(db, Utf8Z("SELECT value FROM ItemTable WHERE key = ?"), -1, out stmt, IntPtr.Zero) != 0) return "";
      try {
        byte[] key = Utf8Z("cursorAuth/accessToken");
        sqlite3_bind_text(stmt, 1, key, key.Length - 1, IntPtr.Zero);
        if (sqlite3_step(stmt) != 100) return "";
        IntPtr p = sqlite3_column_text(stmt, 0);
        if (p == IntPtr.Zero) return "";
        string raw = Marshal.PtrToStringAnsi(p);
        if (string.IsNullOrEmpty(raw)) return "";
        if (raw.StartsWith("eyJ")) return raw;
        const string pref = "cursor-safe-storage:v1:";
        if (!raw.StartsWith(pref)) return "";
        byte[] blob = Convert.FromBase64String(raw.Substring(pref.Length));
        if (blob.Length < 31 || blob[0] != (byte)'v' || blob[1] != (byte)'1' || blob[2] != (byte)'0') return "";
        string ls = System.IO.File.ReadAllText(localStatePath);
        int i = ls.IndexOf("\"encrypted_key\":\"");
        if (i < 0) return "";
        i += 17;
        int j = ls.IndexOf('"', i);
        byte[] enc = Convert.FromBase64String(ls.Substring(i, j - i));
        if (enc.Length < 5) return "";
        byte[] dpapi = new byte[enc.Length - 5];
        Buffer.BlockCopy(enc, 5, dpapi, 0, dpapi.Length);
        byte[] aesKey = Unprotect(dpapi);
        byte[] nonce = new byte[12];
        Buffer.BlockCopy(blob, 3, nonce, 0, 12);
        byte[] tag = new byte[16];
        Buffer.BlockCopy(blob, blob.Length - 16, tag, 0, 16);
        byte[] ct = new byte[blob.Length - 3 - 12 - 16];
        Buffer.BlockCopy(blob, 15, ct, 0, ct.Length);
        return AesGcmDecrypt(aesKey, nonce, ct, tag);
      } finally { sqlite3_finalize(stmt); }
    } finally { sqlite3_close(db); }
  }
}
'@
$db = Join-Path $env:APPDATA 'Cursor\User\globalStorage\state.vscdb'
$ls = Join-Path $env:APPDATA 'Cursor\Local State'
[CursorToken]::Read($db, $ls)
