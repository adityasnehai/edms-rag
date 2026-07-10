export default function Image({
  src,
  alt = "",
  fill,
  width,
  height,
  className,
  style,
  priority: _priority,
  sizes,
  ...props
}) {
  const imageStyle = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }
    : style;

  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={imageStyle}
      sizes={sizes}
      loading={_priority ? "eager" : "lazy"}
      {...props}
    />
  );
}
