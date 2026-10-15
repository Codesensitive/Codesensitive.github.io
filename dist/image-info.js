export const MAX_IMAGE_PIXELS=16000000;
export function imageDimensions(buffer){
  const data=new Uint8Array(buffer),view=new DataView(buffer);let width,height;
  if(data.length>=24&&[137,80,78,71,13,10,26,10].every((byte,i)=>data[i]===byte)){
    width=view.getUint32(16);height=view.getUint32(20);
  }else if(data[0]===255&&data[1]===216){
    let offset=2;
    while(offset+1<data.length){
      if(data[offset++]!==255)throw new Error('Could not read this JPEG image.');
      while(data[offset]===255)offset++;
      const marker=data[offset++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      if(offset+2>data.length)break;
      const length=view.getUint16(offset);if(length<2||offset+length>data.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}
      offset+=length;
    }
  }
  if(!width||!height)throw new Error('Could not read this PNG/JPEG image. It may be damaged or unsupported.');
  if(width*height>MAX_IMAGE_PIXELS)throw new Error('Image exceeds the 16-megapixel limit.');
  return {width,height};
}
