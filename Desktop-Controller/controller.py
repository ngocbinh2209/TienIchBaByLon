import time, ctypes, json, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
try:
    import pyautogui
except ImportError:
    print('Thiếu pyautogui. Hãy chạy INSTALL.bat trước.'); input('Enter để thoát...'); raise
pyautogui.FAILSAFE=True; pyautogui.PAUSE=.12
LOCK=threading.Lock()
GREEN_MIN=(20,120,55); GREEN_MAX=(130,240,175)

def green(rgb):
    r,g,b=rgb[:3]; return GREEN_MIN[0]<=r<=GREEN_MAX[0] and GREEN_MIN[1]<=g<=GREEN_MAX[1] and GREEN_MIN[2]<=b<=GREEN_MAX[2] and g>r*1.22 and g>b*1.05

def find_download_button():
    im=pyautogui.screenshot(); w,h=im.size; pts=[]
    # nút media Cốc Cốc nằm trên video, phía dưới browser chrome
    for y in range(int(h*.075),int(h*.42),3):
      for x in range(int(w*.18),int(w*.72),3):
        if green(im.getpixel((x,y))): pts.append((x,y))
    if not pts:return None
    # gom cụm 36px, ưu tiên cụm nhỏ ở nửa trên (loại nút xanh của trang/sidepanel)
    buckets={}
    for x,y in pts:buckets.setdefault((x//36,y//36),[]).append((x,y))
    cand=[]
    for arr in buckets.values():
      if 3<=len(arr)<=90:
        cx=sum(x for x,_ in arr)//len(arr); cy=sum(y for _,y in arr)//len(arr)
        cand.append((cy,abs(cx-w*.38),-len(arr),cx,cy))
    if not cand:return None
    cand.sort(); return cand[0][3],cand[0][4]

def popup_box(anchor):
    time.sleep(.55); im=pyautogui.screenshot(); w,h=im.size; ax,ay=anchor
    x0=max(0,ax-70); x1=min(w,ax+360); y0=max(0,ay+18); y1=min(h,ay+380)
    # white pixels; derive connected-ish bounding area near anchor
    pts=[]
    for y in range(y0,y1,3):
      for x in range(x0,x1,3):
        r,g,b=im.getpixel((x,y))[:3]
        if r>232 and g>232 and b>232 and max(r,g,b)-min(r,g,b)<15: pts.append((x,y))
    if len(pts)<120:return None
    # rows with many white pixels -> popup vertical extent
    rows={}
    for x,y in pts: rows[y]=rows.get(y,0)+1
    ys=[y for y,n in rows.items() if n>=35]
    if not ys:return None
    top=min(ys); bottom=max(ys)
    # columns only inside popup rows
    xs=[x for x,y in pts if top<=y<=bottom]
    left=min(xs); right=max(xs)
    if right-left<150 or bottom-top<95:return None
    return left,top,right,bottom

def prepare_hq():
    with LOCK:
      p=find_download_button()
      if not p:return {'ok':False,'mode':'error','error':'Không tìm thấy nút xanh tải Cốc Cốc'}
      pyautogui.click(*p)
      box=popup_box(p)
      if not box:
        pyautogui.press('esc'); return {'ok':False,'mode':'error','error':'Không nhận diện được menu chất lượng'}
      l,t,r,b=box; H=b-t
      # menu Standard-only thường chỉ ~150px; HQ có 3 dòng video thường >190px.
      if H<178:
        pyautogui.press('esc'); return {'ok':True,'mode':'standard','choice':'Tiêu chuẩn'}
      # dòng video đầu tiên = chất lượng cao nhất. Tọa độ ~ 36-39% chiều cao popup.
      x=l+int((r-l)*.52); y=t+int(H*.37)
      pyautogui.click(x,y)
      return {'ok':True,'mode':'hq','choice':'VIDEO cao nhất'}

class H(BaseHTTPRequestHandler):
  def log_message(self,*a):pass
  def _send(self,obj):
    b=json.dumps(obj,ensure_ascii=False).encode('utf-8'); self.send_response(200)
    self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(b)
  def do_GET(self):
    u=urlparse(self.path)
    if u.path=='/ping': return self._send({'ok':True,'version':'1.43.07'})
    if u.path=='/prepare':
      ep=parse_qs(u.query).get('episode',['?'])[0]; print(f'Tập {ep}: kiểm tra Cốc Cốc...')
      try:r=prepare_hq()
      except Exception as e:r={'ok':False,'mode':'error','error':repr(e)}
      print(' ->',r); return self._send(r)
    self.send_response(404); self.end_headers()

def main():
  ctypes.windll.kernel32.SetConsoleTitleW('BaByLon 1.43.07 - Cốc Cốc HQ Controller')
  print('BaByLon Desktop Controller 1.43.07')
  print('AUTO HYBRID: 1080/720+ = Cốc Cốc | Standard = downloader legacy 1.43.03')
  print('Đang nghe tại 127.0.0.1:18766. GIỮ cửa sổ này mở khi tải Series.')
  print('Di chuột vào góc trên-trái để dừng khẩn cấp thao tác chuột.')
  ThreadingHTTPServer(('127.0.0.1',18766),H).serve_forever()
if __name__=='__main__':main()
