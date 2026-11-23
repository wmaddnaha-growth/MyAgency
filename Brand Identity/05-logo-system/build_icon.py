import math
CX,CY=515,632
def rays(n=9,a0=17,a1=163,r0=78,r1=152,w0=3,w1=15):
    out=[]
    for i in range(n):
        a=math.radians(a0+(a1-a0)*i/(n-1))
        ux,uy=math.cos(a),-math.sin(a); px,py=-uy,ux
        P=lambda r,w:(CX+ux*r+px*w,CY+uy*r+py*w)
        pts=[P(r0,-w0/2),P(r1,-w1/2),P(r1,w1/2),P(r0,w0/2)]
        # round outer end slightly via arc
        out.append('M%.1f,%.1fL%.1f,%.1fL%.1f,%.1fL%.1f,%.1fZ'%(*pts[0],*pts[1],*pts[2],*pts[3]))
    return ' '.join(out)
SWOOSH='M234,667 C292,646 352,636 402,641 C450,646 482,658 515,658 C548,658 580,646 628,641 C678,636 738,646 790,668 C735,664 668,672 610,684 C566,692 464,692 420,684 C362,672 295,664 234,667Z'
INF='M515,632 C530,606 585,606 585,632 C585,658 530,658 515,632 C500,606 445,606 445,632 C445,658 500,658 515,632Z'
def icon(blue,gold,extra=''):
    return f'<path d="{rays()}" fill="{gold}"/><path d="{SWOOSH}" fill="{gold}"/><path d="{INF}" fill="none" stroke="{blue}" stroke-width="14" stroke-linejoin="round"/>'
if __name__=='__main__':
    print(icon('#1F477E','#B08E4F')[:80])
